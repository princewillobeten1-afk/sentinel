/**
 * Activity Processing Pipeline — Sprint 7
 *
 * Connects raw/normalized blockchain trades, wallet cluster state, funding events,
 * and launcher history to:
 * 1. Build rolling activity feature stores (1m, 5m, 15m, 1h, 4h, 24h, 7d).
 * 2. Calculate Organic Activity Scores & Signals.
 * 3. Analyze Insider Candidates, Early Participants, and Coordinated Groups.
 * 4. Generate Smart Alert Events.
 * 5. Build Wallet Detail Activity Profiles.
 */

import type {
  ActivityContext,
  ActivityPipelineResult,
  ActivityWindow,
  InsiderDetectionReport,
  NormalizedTrade,
  OrganicActivityAssessment,
  WalletActivityProfile,
} from './types';
import { analyzeOrganicActivity } from './organic-engine';
import { analyzeInsiderCandidates } from './insider-engine';
import { buildActivityAlertEvents, buildInsiderAlertEvents } from './alert-events';
import { buildActivityFeatureStore } from './feature-store';

export interface ProcessActivityInput {
  trades: NormalizedTrade[];
  context: ActivityContext;
  windows?: ActivityWindow[];
  currentPositionsUsd?: Record<string, number>;
  realizedPnlUsd?: Record<string, number>;
  unrealizedPnlUsd?: Record<string, number>;
  previousOrganicAssessment?: OrganicActivityAssessment;
}

export function processActivityPipeline(input: ProcessActivityInput): ActivityPipelineResult {
  const featureStore = buildActivityFeatureStore(input.trades, input.context, { windows: input.windows });
  const organicResult = analyzeOrganicActivity({
    trades: input.trades,
    context: input.context,
    windows: input.windows,
  });

  const insiderReport = analyzeInsiderCandidates({
    trades: input.trades,
    context: input.context,
    currentPositionsUsd: input.currentPositionsUsd,
    realizedPnlUsd: input.realizedPnlUsd,
    unrealizedPnlUsd: input.unrealizedPnlUsd,
  });

  const primaryOrganic = organicResult.primaryAssessment ?? Object.values(organicResult.assessments)[0];

  const organicAlerts = primaryOrganic ? buildActivityAlertEvents(primaryOrganic, input.previousOrganicAssessment) : [];
  const insiderAlerts = buildInsiderAlertEvents(insiderReport);

  const alertEvents = [...organicAlerts, ...insiderAlerts].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  return {
    tokenId: input.context.tokenId,
    chain: input.context.chain,
    organicAssessment: primaryOrganic,
    insiderReport,
    featureStore,
    alertEvents,
    processedAt: input.context.observedAt,
  };
}

export function buildWalletProfile(
  address: string,
  chain: string,
  trades: NormalizedTrade[],
  context: ActivityContext,
  insiderReport?: InsiderDetectionReport,
): WalletActivityProfile {
  const walletTrades = trades.filter((trade) => trade.wallet === address);
  const earlyEntry = insiderReport?.earlyParticipants.find((participant) => participant.wallet === address);
  const candidate = insiderReport?.candidates.find((candidateItem) => candidateItem.wallet === address);
  const funding = context.fundingEvents?.filter((eventItem) => eventItem.recipientWallet === address || eventItem.sourceWallet === address) ?? [];
  const clusters = context.clusters?.filter((clusterItem) => clusterItem.wallets.includes(address)).map((clusterItem) => clusterItem.id) ?? [];
  const historical = context.historicalPatterns?.find((patternItem) => patternItem.wallet === address);

  const labels = candidate?.labels ?? (earlyEntry ? ['Early Participant'] : ['Unknown']);

  const buyVolume = walletTrades.filter((trade) => trade.side === 'BUY').reduce((total, trade) => total + trade.amountUsd, 0);
  const sellVolume = walletTrades.filter((trade) => trade.side === 'SELL').reduce((total, trade) => total + trade.amountUsd, 0);

  return {
    walletAddress: address,
    chain,
    labels,
    observedLaunches: historical?.observedLaunches ?? (earlyEntry ? 1 : 0),
    earlyEntriesCount: historical?.earlyEntries ?? (earlyEntry ? 1 : 0),
    profitableExitsCount: historical?.profitableEarlyExits ?? 0,
    winRatePct: historical?.observedLaunches ? Math.round((historical.profitableEarlyExits / historical.observedLaunches) * 100) : undefined,
    averageReturnPct: historical?.averageReturnPct,
    realizedPnlUsd: earlyEntry?.realizedPnlUsd ?? 0,
    unrealizedPnlUsd: earlyEntry?.unrealizedPnlUsd ?? 0,
    earlyEntries: earlyEntry ? [earlyEntry] : [],
    fundingRelationships: funding,
    clusterMemberships: clusters,
    recentTrades: walletTrades.slice(-20),
    activitySummary: {
      totalTrades: walletTrades.length,
      buyVolumeUsd: Math.round(buyVolume),
      sellVolumeUsd: Math.round(sellVolume),
      firstSeen: walletTrades[0]?.timestamp ?? context.observedAt,
      lastSeen: walletTrades[walletTrades.length - 1]?.timestamp ?? context.observedAt,
    },
    updatedAt: context.observedAt,
  };
}
