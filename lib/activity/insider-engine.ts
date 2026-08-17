import type { Evidence } from '@/lib/intelligence/types';
import type {
  ActivityContext,
  EarlyParticipant,
  HistoricalWalletPattern,
  InsiderCandidate,
  InsiderCandidateStatus,
  InsiderDetectionReport,
  InsiderSignal,
  InsiderSignalCategory,
  NormalizedTrade,
  WalletActivityLabel,
  WalletFundingEvent,
} from './types';
import { FEATURE_VERSION, INSIDER_DETECTION_VERSION, clamp, round, secondsBetween, share, toTimestamp, uniqueValues } from './utils';

export interface InsiderDetectionEngineInput {
  trades: NormalizedTrade[];
  context: ActivityContext;
  currentPositionsUsd?: Record<string, number>;
  realizedPnlUsd?: Record<string, number>;
  unrealizedPnlUsd?: Record<string, number>;
}

const EARLY_WINDOWS_SECONDS = [30, 60, 300, 900, 1_800, 3_600];

export function analyzeInsiderCandidates(input: InsiderDetectionEngineInput): InsiderDetectionReport {
  const launchTime = input.context.tradingOpenedAt ?? input.context.firstLiquidityAt ?? input.context.tokenCreatedAt;
  const limitations: string[] = [];

  if (!launchTime) {
    limitations.push('Launch or trading-open timestamp unavailable; early participation analysis is limited.');
  }
  if (!input.context.fundingEvents || input.context.fundingEvents.length === 0) {
    limitations.push('Funding events unavailable or empty; pre-launch funding evidence may be incomplete.');
  }
  if (!input.context.relationships || input.context.relationships.length === 0) {
    limitations.push('Wallet relationship graph unavailable or empty; relationship confidence is reduced.');
  }
  if (!input.context.historicalPatterns || input.context.historicalPatterns.length === 0) {
    limitations.push('Historical launch behavior unavailable; repeated early behavior cannot be fully assessed.');
  }

  const earlyParticipants = detectEarlyParticipants(input, launchTime);
  const candidates = earlyParticipants
    .map((participant) => buildCandidate(participant, input))
    .filter((candidate) => candidate.signals.length > 0)
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence);

  const coordinatedEntryGroups = detectCoordinatedGroups(candidates, earlyParticipants, 'BUY');
  const coordinatedExitGroups = detectCoordinatedExits(candidates, input.trades);
  const highestConfidencePattern = candidates.find((candidate) => candidate.confidence >= 70) ?? candidates[0];

  return {
    tokenId: input.context.tokenId,
    chain: input.context.chain,
    candidates,
    earlyParticipants,
    coordinatedEntryGroups,
    coordinatedExitGroups,
    highestConfidencePattern,
    confidence: computeReportConfidence(candidates, limitations),
    limitations,
    insiderDetectionVersion: INSIDER_DETECTION_VERSION,
    featureVersion: FEATURE_VERSION,
    generatedAt: input.context.observedAt,
  };
}

function detectEarlyParticipants(
  input: InsiderDetectionEngineInput,
  launchTime?: string,
): EarlyParticipant[] {
  const buys = input.trades
    .filter((trade) => trade.side === 'BUY')
    .sort((left, right) => toTimestamp(left.timestamp) - toTimestamp(right.timestamp));
  const firstBuyByWallet = new Map<string, NormalizedTrade>();

  for (const trade of buys) {
    if (!firstBuyByWallet.has(trade.wallet)) firstBuyByWallet.set(trade.wallet, trade);
  }

  const totalBuyVolume = buys.reduce((total, trade) => total + trade.amountUsd, 0);
  const medianBuy = medianAmount(buys);

  return Array.from(firstBuyByWallet.values()).map((trade) => {
    const secondsFromLaunch = launchTime ? Math.max(0, Math.round((toTimestamp(trade.timestamp) - toTimestamp(launchTime)) / 1000)) : Number.POSITIVE_INFINITY;
    const relationshipSignals: InsiderSignalCategory[] = [];
    const funding = findFundingForWallet(trade.wallet, input.context.fundingEvents ?? [], launchTime);

    if (secondsFromLaunch <= 3_600) relationshipSignals.push('EARLY_ENTRY');
    if (funding && launchTime && toTimestamp(funding.timestamp) < toTimestamp(launchTime)) relationshipSignals.push('PRE_LAUNCH_FUNDING');
    if (funding) relationshipSignals.push('FUNDING_RELATIONSHIP');
    if (trade.creatorAssociated || input.context.creatorWallets?.includes(trade.wallet)) relationshipSignals.push('CREATOR_RELATIONSHIP');
    if (trade.clusterId) relationshipSignals.push('CLUSTER_ASSOCIATION');
    if (trade.amountUsd >= Math.max(medianBuy * 5, totalBuyVolume * 0.03)) relationshipSignals.push('UNUSUAL_POSITION_SIZE');

    const earlyScore = scoreEarlyParticipation(secondsFromLaunch, trade, totalBuyVolume, medianBuy);

    return {
      wallet: trade.wallet,
      tokenId: input.context.tokenId,
      chain: input.context.chain,
      entryTime: trade.timestamp,
      secondsFromLaunch,
      entryPriceUsd: trade.priceUsd,
      initialSizeUsd: round(trade.amountUsd, 2),
      percentOfSupply: trade.supplyPct,
      liquidityPct: trade.liquidityPct,
      currentPositionUsd: input.currentPositionsUsd?.[trade.wallet],
      realizedPnlUsd: input.realizedPnlUsd?.[trade.wallet],
      unrealizedPnlUsd: input.unrealizedPnlUsd?.[trade.wallet],
      fundingSource: funding?.sourceWallet ?? trade.fundingSource,
      relationshipSignals,
      earlyParticipationScore: earlyScore,
      evidence: [
        evidence(`${trade.wallet} first bought $${trade.amountUsd.toFixed(2)} ${formatLaunchDelta(secondsFromLaunch)}`, 'normalized_trades', trade.timestamp, trade.amountUsd, 0.86),
      ],
    };
  }).filter((participant) => participant.earlyParticipationScore >= 20 || participant.relationshipSignals.length > 0);
}

function buildCandidate(
  participant: EarlyParticipant,
  input: InsiderDetectionEngineInput,
): InsiderCandidate {
  const signals: InsiderSignal[] = [];
  const evidenceItems: Evidence[] = [...participant.evidence];
  const launchTime = input.context.tradingOpenedAt ?? input.context.firstLiquidityAt ?? input.context.tokenCreatedAt;
  const funding = findFundingForWallet(participant.wallet, input.context.fundingEvents ?? [], launchTime);
  const relationshipEdges = input.context.relationships?.filter((edge) => edge.source === participant.wallet || edge.target === participant.wallet) ?? [];
  const historical = input.context.historicalPatterns?.find((pattern) => pattern.wallet === participant.wallet);

  if (participant.relationshipSignals.includes('EARLY_ENTRY')) {
    signals.push(signal('EARLY_ENTRY', participant.earlyParticipationScore / 100, 0.82, participant.evidence));
  }

  if (funding) {
    const isPreLaunch = launchTime ? toTimestamp(funding.timestamp) < toTimestamp(launchTime) : false;
    const category: InsiderSignalCategory = isPreLaunch ? 'PRE_LAUNCH_FUNDING' : 'FUNDING_RELATIONSHIP';
    const strength = isPreLaunch ? 0.78 : 0.56;
    const fundingEvidence = [evidence(
      `${participant.wallet} received $${funding.amountUsd.toFixed(2)} from ${funding.sourceWallet}${isPreLaunch ? ' before launch' : ''}`,
      'funding_events',
      funding.timestamp,
      funding.amountUsd,
      funding.relationshipToCreator ? 0.9 : 0.78,
    )];
    signals.push(signal(category, strength, funding.relationshipToCreator ? 0.9 : 0.78, fundingEvidence));
    evidenceItems.push(...fundingEvidence);

    if (funding.relationshipToCreator) {
      signals.push(signal('CREATOR_RELATIONSHIP', 0.82, 0.9, fundingEvidence));
    }
  }

  if (participant.relationshipSignals.includes('CREATOR_RELATIONSHIP')) {
    const creatorEvidence = [evidence(`${participant.wallet} is marked creator-associated in observed trade data`, 'creator_relationships', participant.entryTime, participant.wallet, 0.86)];
    signals.push(signal('CREATOR_RELATIONSHIP', 0.78, 0.86, creatorEvidence));
    evidenceItems.push(...creatorEvidence);
  }

  if (participant.relationshipSignals.includes('UNUSUAL_POSITION_SIZE')) {
    const sizeEvidence = [evidence(`Initial position size was $${participant.initialSizeUsd.toFixed(2)}`, 'normalized_trades', participant.entryTime, participant.initialSizeUsd, 0.84)];
    signals.push(signal('UNUSUAL_POSITION_SIZE', 0.58, 0.84, sizeEvidence));
    evidenceItems.push(...sizeEvidence);
  }

  if (participant.relationshipSignals.includes('CLUSTER_ASSOCIATION')) {
    const clusterEvidence = [evidence(`${participant.wallet} belongs to observed cluster-linked activity`, 'wallet_clusters', participant.entryTime, participant.wallet, 0.78)];
    signals.push(signal('CLUSTER_ASSOCIATION', 0.55, 0.78, clusterEvidence));
    evidenceItems.push(...clusterEvidence);
  }

  for (const edge of relationshipEdges.slice(0, 3)) {
    if (edge.type === 'COORDINATED_ACQUISITION') {
      signals.push(signal('COORDINATED_ENTRY', edge.strength, edge.confidence, edge.evidence));
      evidenceItems.push(...edge.evidence);
    }
    if (edge.type === 'COORDINATED_DISPOSAL') {
      signals.push(signal('COORDINATED_EXIT', edge.strength, edge.confidence, edge.evidence));
      evidenceItems.push(...edge.evidence);
    }
  }

  if (historical && historical.earlyEntries >= 3) {
    const strength = Math.min(1, (historical.earlyEntries + historical.profitableEarlyExits) / Math.max(4, historical.observedLaunches * 1.5));
    signals.push(signal('REPEATED_HISTORICAL_PATTERN', strength, 0.8, historical.evidence));
    evidenceItems.push(...historical.evidence);
  }

  const labels = buildWalletLabels(participant, signals, input);
  const score = scoreCandidate(signals, labels);
  const confidence = confidenceForCandidate(signals, labels);
  const capped = capSingleSignal(score, confidence, signals);

  return {
    wallet: participant.wallet,
    token: participant.tokenId,
    score: capped.score,
    confidence: capped.confidence,
    signals,
    evidence: dedupeEvidence(evidenceItems).slice(0, 12),
    firstObserved: participant.entryTime,
    lastObserved: latestObservedForWallet(participant.wallet, input.trades),
    status: candidateStatus(capped.score, capped.confidence, signals),
    labels,
    explanation: explainCandidate(capped.score, signals, labels),
  };
}

function detectCoordinatedGroups(
  candidates: InsiderCandidate[],
  earlyParticipants: EarlyParticipant[],
  side: 'BUY' | 'SELL',
): InsiderCandidate[][] {
  if (side !== 'BUY') return [];

  const groups: InsiderCandidate[][] = [];
  const sorted = [...earlyParticipants].sort((left, right) => toTimestamp(left.entryTime) - toTimestamp(right.entryTime));

  for (let startIndex = 0; startIndex < sorted.length; startIndex++) {
    const groupParticipants = sorted.filter((participant) => secondsBetween(sorted[startIndex].entryTime, participant.entryTime) <= 90);
    const meaningfulGroup = groupParticipants.filter((participant) => participant.initialSizeUsd >= 1_000);
    if (meaningfulGroup.length < 3) continue;

    const groupCandidates = meaningfulGroup
      .map((participant) => candidates.find((candidate) => candidate.wallet === participant.wallet))
      .filter((candidate): candidate is InsiderCandidate => !!candidate);

    if (groupCandidates.length >= 3 && !groups.some((group) => sameWalletSet(group, groupCandidates))) {
      for (const candidate of groupCandidates) {
        if (!candidate.signals.some((existing) => existing.category === 'COORDINATED_ENTRY')) {
          candidate.signals.push(signal('COORDINATED_ENTRY', 0.65, 0.78, [evidence(`${groupCandidates.length} wallets entered within a 90 second window`, 'launch_window_analysis', candidate.firstObserved, groupCandidates.length, 0.78)]));
          const rescored = capSingleSignal(scoreCandidate(candidate.signals, candidate.labels), confidenceForCandidate(candidate.signals, candidate.labels), candidate.signals);
          candidate.score = rescored.score;
          candidate.confidence = rescored.confidence;
          candidate.status = candidateStatus(candidate.score, candidate.confidence, candidate.signals);
        }
      }
      groups.push(groupCandidates);
    }
  }

  return groups;
}

function detectCoordinatedExits(
  candidates: InsiderCandidate[],
  trades: NormalizedTrade[],
): InsiderCandidate[][] {
  const sellsByCandidate = trades
    .filter((trade) => trade.side === 'SELL' && candidates.some((candidate) => candidate.wallet === trade.wallet))
    .sort((left, right) => toTimestamp(left.timestamp) - toTimestamp(right.timestamp));
  const groups: InsiderCandidate[][] = [];

  for (const sell of sellsByCandidate) {
    const nearbySells = sellsByCandidate.filter((otherSell) => secondsBetween(sell.timestamp, otherSell.timestamp) <= 120);
    const wallets = uniqueValues(nearbySells.map((trade) => trade.wallet));
    if (wallets.length < 3) continue;
    const groupCandidates = wallets
      .map((wallet) => candidates.find((candidate) => candidate.wallet === wallet))
      .filter((candidate): candidate is InsiderCandidate => !!candidate);
    if (groupCandidates.length >= 3 && !groups.some((group) => sameWalletSet(group, groupCandidates))) {
      for (const candidate of groupCandidates) {
        if (!candidate.signals.some((existing) => existing.category === 'COORDINATED_EXIT')) {
          candidate.signals.push(signal('COORDINATED_EXIT', 0.62, 0.76, [evidence(`${groupCandidates.length} candidate wallets sold within a 120 second window`, 'exit_window_analysis', sell.timestamp, groupCandidates.length, 0.76)]));
          const rescored = capSingleSignal(scoreCandidate(candidate.signals, candidate.labels), confidenceForCandidate(candidate.signals, candidate.labels), candidate.signals);
          candidate.score = rescored.score;
          candidate.confidence = rescored.confidence;
          candidate.status = candidateStatus(candidate.score, candidate.confidence, candidate.signals);
        }
      }
      groups.push(groupCandidates);
    }
  }

  return groups;
}

function buildWalletLabels(
  participant: EarlyParticipant,
  signals: InsiderSignal[],
  input: InsiderDetectionEngineInput,
): WalletActivityLabel[] {
  const labels: WalletActivityLabel[] = [];
  const walletTrades = input.trades.filter((trade) => trade.wallet === participant.wallet);
  const buyCount = walletTrades.filter((trade) => trade.side === 'BUY').length;
  const sellCount = walletTrades.filter((trade) => trade.side === 'SELL').length;
  const totalVolume = walletTrades.reduce((total, trade) => total + trade.amountUsd, 0);

  if (participant.earlyParticipationScore >= 30) labels.push('Early Participant');
  if (totalVolume >= 100_000) labels.push('High-Volume Trader');
  if (walletTrades.length >= 20) labels.push('Frequent Trader');
  if (signals.some((item) => item.category === 'COORDINATED_ENTRY' || item.category === 'COORDINATED_EXIT')) labels.push('Potentially Coordinated');
  if (signals.some((item) => item.category === 'CREATOR_RELATIONSHIP')) labels.push('Creator-Associated');
  if (buyCount >= 5 && sellCount >= 5 && Math.abs(buyCount - sellCount) / Math.max(1, buyCount + sellCount) < 0.25) labels.push('Market-Maker-Like');
  if (isBotLikeWallet(walletTrades)) labels.push('Bot-Like');

  return labels.length > 0 ? labels : ['Unknown'];
}

function scoreCandidate(signals: InsiderSignal[], labels: WalletActivityLabel[]): number {
  const categoryWeights: Record<InsiderSignalCategory, number> = {
    EARLY_ENTRY: 16,
    CREATOR_RELATIONSHIP: 22,
    FUNDING_RELATIONSHIP: 12,
    PRE_LAUNCH_FUNDING: 18,
    COORDINATED_ENTRY: 16,
    UNUSUAL_POSITION_SIZE: 10,
    COORDINATED_EXIT: 14,
    REPEATED_HISTORICAL_PATTERN: 20,
    CLUSTER_ASSOCIATION: 12,
  };

  const raw = signals.reduce((total, item) => total + categoryWeights[item.category] * item.strength, 0);
  const falsePositiveControl = labels.includes('Market-Maker-Like') ? 10 : labels.includes('Bot-Like') ? 6 : 0;
  return Math.round(clamp(raw - falsePositiveControl));
}

function confidenceForCandidate(signals: InsiderSignal[], labels: WalletActivityLabel[]): number {
  if (signals.length === 0) return 0;
  const independentCategories = new Set(signals.map((item) => item.category)).size;
  const avgSignalConfidence = signals.reduce((total, item) => total + item.confidence, 0) / signals.length;
  let confidence = avgSignalConfidence * 55 + Math.min(35, independentCategories * 8);

  if (labels.includes('Market-Maker-Like')) confidence -= 8;
  if (labels.includes('Bot-Like')) confidence -= 5;

  return Math.round(clamp(confidence));
}

function capSingleSignal(score: number, confidence: number, signals: InsiderSignal[]): { score: number; confidence: number } {
  const independentCategories = new Set(signals.map((item) => item.category)).size;
  if (independentCategories <= 1) {
    return { score: Math.min(score, 42), confidence: Math.min(confidence, 48) };
  }
  if (independentCategories === 2) {
    return { score: Math.min(score, 68), confidence: Math.min(confidence, 72) };
  }
  return { score, confidence };
}

function candidateStatus(
  score: number,
  confidence: number,
  signals: InsiderSignal[],
): InsiderCandidateStatus {
  if (signals.some((item) => item.category === 'CREATOR_RELATIONSHIP' && item.confidence >= 0.95)) return 'VERIFIED_RELATIONSHIP';
  if (score >= 75 && confidence >= 75 && new Set(signals.map((item) => item.category)).size >= 3) return 'HIGH_CONFIDENCE_PATTERN';
  if (score >= 55 && confidence >= 55) return 'POTENTIAL_CONNECTION';
  return 'OBSERVED_PATTERN';
}

function explainCandidate(score: number, signals: InsiderSignal[], labels: WalletActivityLabel[]): string {
  const categories = Array.from(new Set(signals.map((item) => item.category))).join(', ');
  const labelText = labels.filter((label) => label !== 'Unknown').join(', ');
  return `Potential coordination score ${score}/100 based on observed patterns${categories ? `: ${categories}` : ''}${labelText ? `. Labels: ${labelText}` : ''}. This does not establish insider status.`;
}

function scoreEarlyParticipation(
  secondsFromLaunch: number,
  trade: NormalizedTrade,
  totalBuyVolume: number,
  medianBuy: number,
): number {
  let score = 0;

  if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[0]) score += 45;
  else if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[1]) score += 38;
  else if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[2]) score += 30;
  else if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[3]) score += 22;
  else if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[4]) score += 14;
  else if (secondsFromLaunch <= EARLY_WINDOWS_SECONDS[5]) score += 8;

  score += Math.min(30, share(trade.amountUsd, Math.max(1, totalBuyVolume)) * 300);
  if (medianBuy > 0) score += Math.min(25, (trade.amountUsd / medianBuy) * 3);
  if (trade.supplyPct) score += Math.min(20, trade.supplyPct * 400);
  if (trade.liquidityPct) score += Math.min(20, trade.liquidityPct * 200);

  return Math.round(clamp(score));
}

function findFundingForWallet(
  wallet: string,
  fundingEvents: WalletFundingEvent[],
  launchTime?: string,
): WalletFundingEvent | undefined {
  const events = fundingEvents
    .filter((eventItem) => eventItem.recipientWallet === wallet)
    .sort((left, right) => {
      if (!launchTime) return toTimestamp(right.timestamp) - toTimestamp(left.timestamp);
      return Math.abs(toTimestamp(left.timestamp) - toTimestamp(launchTime)) - Math.abs(toTimestamp(right.timestamp) - toTimestamp(launchTime));
    });
  return events[0];
}

function isBotLikeWallet(trades: NormalizedTrade[]): boolean {
  if (trades.length < 10) return false;
  const timestamps = trades.map((trade) => toTimestamp(trade.timestamp)).sort((left, right) => left - right);
  const intervals = timestamps.slice(1).map((timestamp, index) => (timestamp - timestamps[index]) / 1000);
  const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
  const variance = intervals.reduce((total, interval) => total + (interval - average) ** 2, 0) / intervals.length;
  const repeatedAmounts = new Set(trades.map((trade) => Math.round(trade.amountUsd))).size <= Math.max(2, trades.length * 0.2);
  return average > 0 && Math.sqrt(variance) / average < 0.15 && repeatedAmounts;
}

function latestObservedForWallet(wallet: string, trades: NormalizedTrade[]): string {
  const walletTrades = trades.filter((trade) => trade.wallet === wallet);
  return walletTrades.reduce((latest, trade) => toTimestamp(trade.timestamp) > toTimestamp(latest) ? trade.timestamp : latest, walletTrades[0]?.timestamp ?? new Date(0).toISOString());
}

function computeReportConfidence(candidates: InsiderCandidate[], limitations: string[]): number {
  if (candidates.length === 0) return limitations.length > 0 ? 25 : 50;
  const candidateConfidence = candidates.reduce((total, candidate) => total + candidate.confidence, 0) / candidates.length;
  return Math.round(clamp(candidateConfidence - limitations.length * 4));
}

function sameWalletSet(left: InsiderCandidate[], right: InsiderCandidate[]): boolean {
  const leftSet = new Set(left.map((candidate) => candidate.wallet));
  const rightSet = new Set(right.map((candidate) => candidate.wallet));
  return leftSet.size === rightSet.size && Array.from(leftSet).every((wallet) => rightSet.has(wallet));
}

function medianAmount(trades: NormalizedTrade[]): number {
  if (trades.length === 0) return 0;
  const sorted = trades.map((trade) => trade.amountUsd).sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function signal(
  category: InsiderSignalCategory,
  strength: number,
  confidence: number,
  evidenceItems: Evidence[],
): InsiderSignal {
  return {
    category,
    strength: round(clamp(strength, 0, 1), 4),
    confidence: round(clamp(confidence, 0, 1), 4),
    evidence: evidenceItems,
  };
}

function evidence(
  fact: string,
  source: string,
  observedAt: string,
  value: string | number,
  confidence: number,
): Evidence {
  return { fact, source, observedAt, value, confidence };
}

function dedupeEvidence(evidenceItems: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const deduped: Evidence[] = [];
  for (const item of evidenceItems) {
    const key = `${item.fact}:${item.observedAt}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }
  return deduped;
}

function formatLaunchDelta(secondsFromLaunch: number): string {
  if (!Number.isFinite(secondsFromLaunch)) return 'with unavailable launch timing';
  if (secondsFromLaunch <= 0) return 'at or before trading open';
  return `${secondsFromLaunch}s after trading open`;
}

function historicalPatternSignal(pattern?: HistoricalWalletPattern): boolean {
  return !!pattern && pattern.earlyEntries >= 3;
}
