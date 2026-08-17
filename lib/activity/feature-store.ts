import type { Evidence } from '@/lib/intelligence/types';
import type {
  ActivityContext,
  ActivityFeatureStoreSnapshot,
  ActivityPersistence,
  ActivityQualityFeatureSet,
  ActivityWindow,
  ClusterActivity,
  ConcentrationMetrics,
  NormalizedTrade,
  ParticipationMetrics,
  RepeatWalletMetrics,
  TemporalMetrics,
  TemporalPattern,
  TransactionDistribution,
  WalletPairInteraction,
  WindowAssessmentStatus,
} from './types';
import {
  DEFAULT_WINDOWS,
  FEATURE_VERSION,
  WINDOW_SECONDS,
  filterTradesForWindow,
  giniCoefficient,
  herfindahlIndex,
  mean,
  median,
  percentile,
  round,
  share,
  stdDev,
  toTimestamp,
  uniqueValues,
} from './utils';

const MIN_SAMPLE_SIZE = 20;

export interface BuildActivityFeatureOptions {
  windows?: ActivityWindow[];
}

export function buildActivityFeatureStore(
  trades: NormalizedTrade[],
  context: ActivityContext,
  options: BuildActivityFeatureOptions = {},
): ActivityFeatureStoreSnapshot {
  const windows = options.windows ?? DEFAULT_WINDOWS;
  const snapshot: ActivityFeatureStoreSnapshot = {
    tokenId: context.tokenId,
    chain: context.chain,
    windows: {},
    generatedAt: context.observedAt,
    featureVersion: FEATURE_VERSION,
  };

  for (const window of windows) {
    const windowTrades = filterTradesForWindow(trades, context.observedAt, window);
    snapshot.windows[window] = buildWindowFeatures(windowTrades, context, window);
  }

  return snapshot;
}

export class RollingActivityFeatureStore {
  private tradesByToken = new Map<string, NormalizedTrade[]>();

  ingestTrade(trade: NormalizedTrade): void {
    const trades = this.tradesByToken.get(trade.tokenId) ?? [];
    if (!trades.some((existing) => existing.id === trade.id || (trade.txHash && existing.txHash === trade.txHash))) {
      trades.push(trade);
      trades.sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp));
      this.tradesByToken.set(trade.tokenId, trades);
    }
  }

  ingestTrades(trades: NormalizedTrade[]): void {
    for (const trade of trades) {
      this.ingestTrade(trade);
    }
  }

  snapshot(context: ActivityContext, options: BuildActivityFeatureOptions = {}): ActivityFeatureStoreSnapshot {
    return buildActivityFeatureStore(this.tradesByToken.get(context.tokenId) ?? [], context, options);
  }
}

export function buildWindowFeatures(
  trades: NormalizedTrade[],
  context: ActivityContext,
  window: ActivityWindow,
): ActivityQualityFeatureSet {
  const limitations: string[] = [];
  const sampleSize = trades.length;
  const status = getWindowStatus(trades, context, window);
  const freshnessSeconds = getFreshnessSeconds(trades, context.observedAt);
  const dataCoverage = computeDataCoverage(trades, context, status);

  if (sampleSize < MIN_SAMPLE_SIZE) {
    limitations.push(`Only ${sampleSize} trades observed in ${window}; confidence is reduced.`);
  }
  if (!context.dataCompleteFrom || !context.dataCompleteTo) {
    limitations.push('Provider coverage bounds are unavailable for this window.');
  }
  if (!context.clusters || context.clusters.length === 0) {
    limitations.push('Cluster data unavailable or empty; cluster concentration may be understated.');
  }
  if (!context.fundingEvents || context.fundingEvents.length === 0) {
    limitations.push('Funding data unavailable or empty; funding-linked coordination may be understated.');
  }

  const participation = computeParticipation(trades, context);
  const concentration = computeConcentration(trades, participation);
  const transactionDistribution = computeTransactionDistribution(trades);
  const repeatWallets = computeRepeatWallets(trades, participation.uniqueActiveWallets);
  const temporal = computeTemporalMetrics(trades, context, window);
  const pairInteractions = computePairInteractions(trades, context);
  const clusterActivity = computeClusterActivity(trades, context, participation.totalVolumeUsd);
  const creatorLinkedVolumeUsd = trades
    .filter((trade) => trade.creatorAssociated || context.creatorWallets?.includes(trade.wallet))
    .reduce((total, trade) => total + trade.amountUsd, 0);
  const creatorLinkedVolumeShare = share(creatorLinkedVolumeUsd, participation.totalVolumeUsd);
  const botLikeScore = computeBotLikeScore(trades, transactionDistribution, temporal);
  const marketMakerLikeScore = computeMarketMakerLikeScore(participation, repeatWallets, temporal);
  const circularActivityScore = computeCircularActivityScore(pairInteractions, participation);

  return {
    window,
    status,
    sampleSize,
    freshnessSeconds,
    dataCoverage,
    participation,
    concentration,
    transactionDistribution,
    repeatWallets,
    temporal,
    pairInteractions,
    clusterActivity,
    creatorLinkedVolumeUsd: round(creatorLinkedVolumeUsd, 2),
    creatorLinkedVolumeShare: round(creatorLinkedVolumeShare),
    botLikeScore,
    marketMakerLikeScore,
    circularActivityScore,
    featureVersion: FEATURE_VERSION,
    limitations,
  };
}

function getWindowStatus(
  trades: NormalizedTrade[],
  context: ActivityContext,
  window: ActivityWindow,
): WindowAssessmentStatus {
  if (trades.length === 0) return 'UNKNOWN';
  if (trades.length < MIN_SAMPLE_SIZE) return 'INSUFFICIENT_DATA';

  const freshnessSeconds = getFreshnessSeconds(trades, context.observedAt);
  if (freshnessSeconds > Math.max(WINDOW_SECONDS[window], 300)) return 'STALE';

  return 'AVAILABLE';
}

function getFreshnessSeconds(trades: NormalizedTrade[], observedAt: string): number {
  if (trades.length === 0) return Number.POSITIVE_INFINITY;
  const latest = trades.reduce((max, trade) => Math.max(max, toTimestamp(trade.timestamp)), 0);
  return Math.max(0, Math.round((toTimestamp(observedAt) - latest) / 1000));
}

function computeDataCoverage(
  trades: NormalizedTrade[],
  context: ActivityContext,
  status: WindowAssessmentStatus,
): number {
  if (trades.length === 0) return 0;

  let coverage = status === 'AVAILABLE' ? 0.65 : 0.4;
  if (trades.length >= 100) coverage += 0.1;
  if (trades.length >= 1_000) coverage += 0.1;
  if (context.dataCompleteFrom && context.dataCompleteTo) coverage += 0.1;
  if (context.clusters && context.clusters.length > 0) coverage += 0.05;
  if (context.fundingEvents && context.fundingEvents.length > 0) coverage += 0.05;
  return round(Math.min(1, coverage));
}

function computeParticipation(trades: NormalizedTrade[], context: ActivityContext): ParticipationMetrics {
  const walletVolumes = new Map<string, number>();
  const buyerWallets = new Set<string>();
  const sellerWallets = new Set<string>();
  let buyVolumeUsd = 0;
  let sellVolumeUsd = 0;
  let buyCount = 0;
  let sellCount = 0;

  for (const trade of trades) {
    walletVolumes.set(trade.wallet, (walletVolumes.get(trade.wallet) ?? 0) + trade.amountUsd);
    if (trade.side === 'BUY') {
      buyVolumeUsd += trade.amountUsd;
      buyCount++;
      buyerWallets.add(trade.wallet);
    } else {
      sellVolumeUsd += trade.amountUsd;
      sellCount++;
      sellerWallets.add(trade.wallet);
    }
  }

  const uniqueActiveWallets = walletVolumes.size;
  const volumeValues = Array.from(walletVolumes.values()).sort((a, b) => b - a);
  const totalVolumeUsd = buyVolumeUsd + sellVolumeUsd;
  const returningWallets = trades.length - uniqueActiveWallets;
  const both = Array.from(buyerWallets).filter((wallet) => sellerWallets.has(wallet)).length;

  const firstSeenCutoff = context.dataCompleteFrom ? toTimestamp(context.dataCompleteFrom) : 0;
  const walletsFirstSeenInWindow = new Set<string>();
  for (const wallet of walletVolumes.keys()) {
    const firstTrade = trades.find((trade) => trade.wallet === wallet);
    if (firstTrade && toTimestamp(firstTrade.timestamp) >= firstSeenCutoff) {
      walletsFirstSeenInWindow.add(wallet);
    }
  }

  return {
    totalVolumeUsd: round(totalVolumeUsd, 2),
    buyVolumeUsd: round(buyVolumeUsd, 2),
    sellVolumeUsd: round(sellVolumeUsd, 2),
    buyCount,
    sellCount,
    totalTransactions: trades.length,
    uniqueBuyers: buyerWallets.size,
    uniqueSellers: sellerWallets.size,
    uniqueActiveWallets,
    walletsOnlyBuy: buyerWallets.size - both,
    walletsOnlySell: sellerWallets.size - both,
    walletsBothBuySell: both,
    newParticipantRatio: round(share(walletsFirstSeenInWindow.size, uniqueActiveWallets)),
    returningParticipantRatio: round(share(Math.max(0, returningWallets), trades.length)),
    volumePerWallet: Object.fromEntries(walletVolumes),
    medianVolumePerWallet: round(median(volumeValues), 2),
    meanVolumePerWallet: round(mean(volumeValues), 2),
    top1WalletShare: round(share(volumeValues[0] ?? 0, totalVolumeUsd)),
    top5WalletShare: round(share(volumeValues.slice(0, 5).reduce((total, value) => total + value, 0), totalVolumeUsd)),
    top10WalletShare: round(share(volumeValues.slice(0, 10).reduce((total, value) => total + value, 0), totalVolumeUsd)),
  };
}

function computeConcentration(
  trades: NormalizedTrade[],
  participation: ParticipationMetrics,
): ConcentrationMetrics {
  const volumes = Object.values(participation.volumePerWallet).sort((a, b) => b - a);
  const shares = volumes.map((value) => share(value, participation.totalVolumeUsd));
  const clusterVolumes = new Map<string, number>();

  for (const trade of trades) {
    if (trade.clusterId) {
      clusterVolumes.set(trade.clusterId, (clusterVolumes.get(trade.clusterId) ?? 0) + trade.amountUsd);
    }
  }

  const clusterVolumeValues = Array.from(clusterVolumes.values()).sort((a, b) => b - a);

  return {
    topWalletVolumeShare: round(shares[0] ?? 0),
    topClusterVolumeShare: round(share(clusterVolumeValues[0] ?? 0, participation.totalVolumeUsd)),
    hhi: round(herfindahlIndex(shares)),
    gini: round(giniCoefficient(volumes)),
    percentileDistribution: {
      p50: round(percentile(volumes, 50), 2),
      p75: round(percentile(volumes, 75), 2),
      p90: round(percentile(volumes, 90), 2),
      p95: round(percentile(volumes, 95), 2),
      p99: round(percentile(volumes, 99), 2),
    },
  };
}

function computeTransactionDistribution(trades: NormalizedTrade[]): TransactionDistribution {
  const sizes = trades.map((trade) => trade.amountUsd).sort((a, b) => a - b);
  const totalVolume = sizes.reduce((total, value) => total + value, 0);
  const p50 = percentile(sizes, 50);
  const p90 = percentile(sizes, 90);
  const roundedSizeCounts = new Map<number, number>();

  for (const size of sizes) {
    const roundedSize = Math.round(size / Math.max(1, p50 * 0.01 || 1));
    roundedSizeCounts.set(roundedSize, (roundedSizeCounts.get(roundedSize) ?? 0) + 1);
  }

  const repeatedTransactions = Array.from(roundedSizeCounts.values())
    .filter((count) => count >= Math.max(4, trades.length * 0.05))
    .reduce((total, count) => total + count, 0);

  const small = sizes.filter((size) => size <= p50);
  const medium = sizes.filter((size) => size > p50 && size <= p90);
  const large = sizes.filter((size) => size > p90);

  return {
    medianTradeSizeUsd: round(p50, 2),
    meanTradeSizeUsd: round(mean(sizes), 2),
    stdDevTradeSizeUsd: round(stdDev(sizes), 2),
    percentiles: {
      p10: round(percentile(sizes, 10), 2),
      p25: round(percentile(sizes, 25), 2),
      p50: round(p50, 2),
      p75: round(percentile(sizes, 75), 2),
      p90: round(p90, 2),
      p95: round(percentile(sizes, 95), 2),
      p99: round(percentile(sizes, 99), 2),
    },
    repeatedSizeRatio: round(share(repeatedTransactions, trades.length)),
    repeatedSizeSignificance: round(share(repeatedTransactions, trades.length) * Math.log10(Math.max(10, trades.length))),
    tradeSizeBuckets: {
      small: buildBucket(small, totalVolume),
      medium: buildBucket(medium, totalVolume),
      large: buildBucket(large, totalVolume),
    },
  };
}

function buildBucket(values: number[], totalVolume: number) {
  const volumeUsd = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    volumeUsd: round(volumeUsd, 2),
    share: round(share(volumeUsd, totalVolume)),
  };
}

function computeRepeatWallets(
  trades: NormalizedTrade[],
  uniqueWallets: number,
): RepeatWalletMetrics {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    counts.set(trade.wallet, (counts.get(trade.wallet) ?? 0) + 1);
  }

  let oneTransaction = 0;
  let twoToFiveTransactions = 0;
  let sixToTwentyTransactions = 0;
  let overTwentyTransactions = 0;

  for (const count of counts.values()) {
    if (count === 1) oneTransaction++;
    else if (count <= 5) twoToFiveTransactions++;
    else if (count <= 20) sixToTwentyTransactions++;
    else overTwentyTransactions++;
  }

  return {
    oneTransaction,
    twoToFiveTransactions,
    sixToTwentyTransactions,
    overTwentyTransactions,
    repeatWalletRatio: round(share(uniqueWallets - oneTransaction, uniqueWallets)),
  };
}

function computeTemporalMetrics(
  trades: NormalizedTrade[],
  context: ActivityContext,
  window: ActivityWindow,
): TemporalMetrics {
  if (trades.length <= 1) {
    return {
      pattern: 'UNKNOWN',
      burstScore: 0,
      periodicityScore: 0,
      inactivityGapCount: 0,
      averageInterTradeSeconds: 0,
      activityPersistence: 'UNKNOWN',
    };
  }

  const timestamps = trades.map((trade) => toTimestamp(trade.timestamp)).sort((a, b) => a - b);
  const intervals = timestamps.slice(1).map((timestamp, index) => (timestamp - timestamps[index]) / 1000);
  const avgInterval = mean(intervals);
  const intervalStdDev = stdDev(intervals);
  const burstThreshold = Math.max(5, avgInterval * 0.2);
  const burstIntervals = intervals.filter((interval) => interval <= burstThreshold).length;
  const inactivityGapCount = intervals.filter((interval) => interval >= Math.max(300, WINDOW_SECONDS[window] * 0.15)).length;
  const periodicityScore = avgInterval === 0 ? 0 : Math.max(0, 1 - intervalStdDev / avgInterval);
  const burstScore = share(burstIntervals, intervals.length);

  let pattern: TemporalPattern = 'CONTINUOUS';
  if (inactivityGapCount >= 2 && burstScore > 0.45) pattern = 'BURSTY';
  else if (periodicityScore > 0.82 && trades.length >= 10) pattern = 'PERIODIC';
  else if (burstScore > 0.65) pattern = 'CLUSTERED';
  else if (context.tradingOpenedAt && secondsSince(context.tradingOpenedAt, trades[0].timestamp) < 300) pattern = 'EVENT_DRIVEN';

  return {
    pattern,
    burstScore: round(burstScore),
    periodicityScore: round(periodicityScore),
    inactivityGapCount,
    averageInterTradeSeconds: round(avgInterval, 2),
    activityPersistence: computePersistence(trades, window),
  };
}

function computePersistence(trades: NormalizedTrade[], window: ActivityWindow): ActivityPersistence {
  if (trades.length < MIN_SAMPLE_SIZE) return 'UNKNOWN';

  const timestamps = trades.map((trade) => toTimestamp(trade.timestamp));
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const duration = Math.max(1, (maxTime - minTime) / 1000);
  const bucketCount = Math.min(12, Math.max(3, Math.ceil(WINDOW_SECONDS[window] / Math.max(60, duration / 6))));
  const bucketSize = duration / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const timestamp of timestamps) {
    const index = Math.min(bucketCount - 1, Math.floor((timestamp - minTime) / 1000 / bucketSize));
    buckets[index]++;
  }

  const activeBuckets = buckets.filter((count) => count > 0).length;
  const firstHalf = buckets.slice(0, Math.ceil(bucketCount / 2)).reduce((total, count) => total + count, 0);
  const secondHalf = buckets.slice(Math.ceil(bucketCount / 2)).reduce((total, count) => total + count, 0);
  const largestBucketShare = Math.max(...buckets) / trades.length;

  if (largestBucketShare > 0.65) return 'SPIKE_DRIVEN';
  if (activeBuckets / bucketCount > 0.7) return 'PERSISTENT';
  if (secondHalf > firstHalf * 1.35) return 'GROWING';
  if (firstHalf > secondHalf * 1.35) return 'DECLINING';
  return 'TEMPORARY';
}

function computePairInteractions(
  trades: NormalizedTrade[],
  context: ActivityContext,
): WalletPairInteraction[] {
  const interactions = new Map<string, WalletPairInteraction>();

  for (const trade of trades) {
    if (!trade.counterparty) continue;
    const [walletA, walletB] = [trade.wallet, trade.counterparty].sort();
    const key = `${walletA}:${walletB}`;
    const existing = interactions.get(key);
    const evidence = mkEvidence(
      `${trade.wallet} interacted with ${trade.counterparty} for $${trade.amountUsd.toFixed(2)}`,
      'normalized_trades',
      trade.timestamp,
      trade.amountUsd,
      0.85,
    );

    if (!existing) {
      interactions.set(key, {
        walletA,
        walletB,
        interactions: 1,
        volumeUsd: round(trade.amountUsd, 2),
        direction: 'ONE_WAY',
        firstObserved: trade.timestamp,
        lastObserved: trade.timestamp,
        evidence: [evidence],
      });
      continue;
    }

    existing.interactions++;
    existing.volumeUsd = round(existing.volumeUsd + trade.amountUsd, 2);
    existing.firstObserved = toTimestamp(trade.timestamp) < toTimestamp(existing.firstObserved) ? trade.timestamp : existing.firstObserved;
    existing.lastObserved = toTimestamp(trade.timestamp) > toTimestamp(existing.lastObserved) ? trade.timestamp : existing.lastObserved;
    if (existing.walletA === trade.counterparty || existing.walletB === trade.wallet) {
      existing.direction = 'TWO_WAY';
    }
    if (existing.evidence.length < 5) existing.evidence.push(evidence);
  }

  for (const relationship of context.relationships ?? []) {
    const [walletA, walletB] = [relationship.source, relationship.target].sort();
    const key = `${walletA}:${walletB}`;
    const existing = interactions.get(key);
    if (existing && existing.evidence.length < 5) {
      existing.evidence.push(...relationship.evidence.slice(0, 2).map((item) => ({ ...item, confidence: Math.min(item.confidence, relationship.confidence) })));
    }
  }

  return Array.from(interactions.values())
    .filter((interaction) => interaction.interactions >= 2)
    .sort((a, b) => b.interactions - a.interactions || b.volumeUsd - a.volumeUsd)
    .slice(0, 20);
}

function computeClusterActivity(
  trades: NormalizedTrade[],
  context: ActivityContext,
  totalVolumeUsd: number,
): ClusterActivity[] {
  const clusterMap = new Map<string, ClusterActivity>();
  const clusterWallets = new Map<string, string[]>();

  for (const cluster of context.clusters ?? []) {
    clusterWallets.set(cluster.id, cluster.wallets);
  }

  for (const trade of trades) {
    const clusterId = trade.clusterId ?? findClusterIdForWallet(trade.wallet, clusterWallets);
    if (!clusterId) continue;
    const existing = clusterMap.get(clusterId);
    const wallets = uniqueValues([...(clusterWallets.get(clusterId) ?? []), trade.wallet]);
    if (!existing) {
      clusterMap.set(clusterId, {
        clusterId,
        wallets,
        volumeUsd: round(trade.amountUsd, 2),
        buyVolumeUsd: trade.side === 'BUY' ? round(trade.amountUsd, 2) : 0,
        sellVolumeUsd: trade.side === 'SELL' ? round(trade.amountUsd, 2) : 0,
        transactions: 1,
        shareOfVolume: round(share(trade.amountUsd, totalVolumeUsd)),
        timingSpreadSeconds: 0,
        confidence: 0.7,
        evidence: [mkEvidence(`Cluster ${clusterId} participated in observed trades`, 'cluster_activity', trade.timestamp, trade.amountUsd, 0.75)],
      });
      continue;
    }

    existing.wallets = uniqueValues([...existing.wallets, trade.wallet]);
    existing.volumeUsd = round(existing.volumeUsd + trade.amountUsd, 2);
    existing.buyVolumeUsd = round(existing.buyVolumeUsd + (trade.side === 'BUY' ? trade.amountUsd : 0), 2);
    existing.sellVolumeUsd = round(existing.sellVolumeUsd + (trade.side === 'SELL' ? trade.amountUsd : 0), 2);
    existing.transactions++;
    existing.shareOfVolume = round(share(existing.volumeUsd, totalVolumeUsd));
    if (existing.evidence.length < 5) {
      existing.evidence.push(mkEvidence(`Cluster ${clusterId} trade volume accumulated`, 'cluster_activity', trade.timestamp, existing.volumeUsd, 0.75));
    }
  }

  for (const activity of clusterMap.values()) {
    const clusterTrades = trades.filter((trade) => trade.clusterId === activity.clusterId || activity.wallets.includes(trade.wallet));
    const timestamps = clusterTrades.map((trade) => toTimestamp(trade.timestamp));
    activity.timingSpreadSeconds = timestamps.length ? round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000, 2) : 0;
  }

  return Array.from(clusterMap.values())
    .sort((a, b) => b.shareOfVolume - a.shareOfVolume)
    .slice(0, 20);
}

function findClusterIdForWallet(wallet: string, clusterWallets: Map<string, string[]>): string | undefined {
  for (const [clusterId, wallets] of clusterWallets.entries()) {
    if (wallets.includes(wallet)) return clusterId;
  }
  return undefined;
}

function computeBotLikeScore(
  trades: NormalizedTrade[],
  distribution: TransactionDistribution,
  temporal: TemporalMetrics,
): number {
  if (trades.length < MIN_SAMPLE_SIZE) return 0;

  let score = 0;
  if (temporal.periodicityScore > 0.75) score += 35;
  if (distribution.repeatedSizeRatio > 0.35) score += 30;
  if (temporal.averageInterTradeSeconds > 0 && temporal.averageInterTradeSeconds < 8) score += 20;
  if (trades.length > 500) score += 15;

  return Math.round(Math.min(100, score));
}

function computeMarketMakerLikeScore(
  participation: ParticipationMetrics,
  repeatWallets: RepeatWalletMetrics,
  temporal: TemporalMetrics,
): number {
  const total = participation.buyCount + participation.sellCount;
  const buyShare = share(participation.buyCount, total);
  const twoSidedShare = share(participation.walletsBothBuySell, participation.uniqueActiveWallets);
  const buySellBalance = 1 - Math.abs(0.5 - buyShare) * 2;

  let score = buySellBalance * 35 + twoSidedShare * 30 + repeatWallets.repeatWalletRatio * 15;
  if (temporal.activityPersistence === 'PERSISTENT') score += 20;
  return Math.round(Math.min(100, score));
}

function computeCircularActivityScore(
  interactions: WalletPairInteraction[],
  participation: ParticipationMetrics,
): number {
  const twoWayInteractions = interactions.filter((interaction) => interaction.direction === 'TWO_WAY');
  const repeatedPairVolume = twoWayInteractions.reduce((total, interaction) => total + interaction.volumeUsd, 0);
  const repeatedPairShare = share(repeatedPairVolume, participation.totalVolumeUsd);
  const repeatedPairIntensity = share(twoWayInteractions.filter((interaction) => interaction.interactions >= 5).length, Math.max(1, interactions.length));

  return Math.round(Math.min(100, repeatedPairShare * 60 + repeatedPairIntensity * 40));
}

function mkEvidence(
  fact: string,
  source: string,
  observedAt: string,
  value: string | number,
  confidence: number,
): Evidence {
  return { fact, source, observedAt, value, confidence };
}

function secondsSince(a: string, b: string): number {
  return (toTimestamp(b) - toTimestamp(a)) / 1000;
}
