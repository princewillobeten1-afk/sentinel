import type { Evidence } from '@/lib/intelligence/types';
import type {
  ActivityContext,
  ActivityFeatureStoreSnapshot,
  ActivityQualityFeatureSet,
  ActivityWindow,
  NormalizedTrade,
  OrganicActivityAssessment,
  OrganicActivitySignal,
  WindowAssessmentStatus,
} from './types';
import { buildActivityFeatureStore } from './feature-store';
import { FEATURE_VERSION, ORGANIC_VOLUME_VERSION, clamp, round, scoreFromPenalty } from './utils';

export interface OrganicActivityEngineInput {
  trades: NormalizedTrade[];
  context: ActivityContext;
  windows?: ActivityWindow[];
}

export interface OrganicActivityEngineResult {
  tokenId: string;
  chain: string;
  assessments: Partial<Record<ActivityWindow, OrganicActivityAssessment>>;
  primaryWindow: ActivityWindow;
  primaryAssessment?: OrganicActivityAssessment;
  featureStore: ActivityFeatureStoreSnapshot;
  generatedAt: string;
}

export function analyzeOrganicActivity(input: OrganicActivityEngineInput): OrganicActivityEngineResult {
  const featureStore = buildActivityFeatureStore(input.trades, input.context, { windows: input.windows });
  const assessments: Partial<Record<ActivityWindow, OrganicActivityAssessment>> = {};

  for (const [window, features] of Object.entries(featureStore.windows) as [ActivityWindow, ActivityQualityFeatureSet][]) {
    assessments[window] = assessWindow(input.context, features);
  }

  const primaryWindow = choosePrimaryWindow(assessments);

  return {
    tokenId: input.context.tokenId,
    chain: input.context.chain,
    assessments,
    primaryWindow,
    primaryAssessment: assessments[primaryWindow],
    featureStore,
    generatedAt: input.context.observedAt,
  };
}

export function assessWindow(
  context: ActivityContext,
  features: ActivityQualityFeatureSet,
): OrganicActivityAssessment {
  const signals = buildOrganicSignals(features, context);
  const penalties = [
    features.concentration.topWalletVolumeShare * 22,
    features.participation.top5WalletShare * 16,
    features.concentration.topClusterVolumeShare * 18,
    features.repeatWallets.repeatWalletRatio * 12,
    features.transactionDistribution.repeatedSizeSignificance * 14,
    features.temporal.burstScore * 10,
    features.circularActivityScore * 0.16,
    features.botLikeScore * 0.1,
    features.creatorLinkedVolumeShare * 12,
  ];

  const bonuses = [
    Math.min(14, Math.log10(Math.max(1, features.participation.uniqueActiveWallets)) * 5),
    (1 - features.participation.top10WalletShare) * 10,
    features.temporal.activityPersistence === 'PERSISTENT' ? 7 : 0,
    features.marketMakerLikeScore > 70 ? 3 : 0,
  ];

  let score = scoreFromPenalty(78, penalties, bonuses);

  if (features.status !== 'AVAILABLE') {
    score = Math.round(score * 0.85);
  }

  const confidence = computeOrganicConfidence(features);

  return {
    tokenId: context.tokenId,
    chain: context.chain,
    window: features.window,
    status: features.status,
    score,
    interpretation: interpretOrganicScore(score),
    confidence,
    dataCoverage: features.dataCoverage,
    freshness: freshnessStatus(features),
    sampleSize: features.sampleSize,
    features,
    signals,
    limitations: features.limitations,
    organicVolumeVersion: ORGANIC_VOLUME_VERSION,
    featureVersion: FEATURE_VERSION,
    generatedAt: context.observedAt,
  };
}

function buildOrganicSignals(
  features: ActivityQualityFeatureSet,
  context: ActivityContext,
): OrganicActivitySignal[] {
  const observedAt = context.observedAt;
  const signals: OrganicActivitySignal[] = [];

  signals.push({
    type: 'PARTICIPANT_DIVERSITY',
    severity: features.participation.uniqueActiveWallets >= 200 ? 'INFO' : 'LOW',
    dimension: features.participation.uniqueActiveWallets >= 200 ? 'ORGANIC' : 'UNKNOWN',
    value: features.participation.uniqueActiveWallets,
    confidence: 0.86,
    evidence: [evidence(`${features.participation.uniqueActiveWallets} unique active wallets observed`, 'activity_features', observedAt, features.participation.uniqueActiveWallets, 0.86)],
  });

  if (features.participation.top5WalletShare >= 0.4) {
    signals.push({
      type: 'VOLUME_CONCENTRATION',
      severity: features.participation.top5WalletShare >= 0.65 ? 'HIGH' : 'MEDIUM',
      dimension: 'COORDINATED',
      value: round(features.participation.top5WalletShare),
      confidence: 0.88,
      evidence: [evidence(`Top 5 wallets represent ${(features.participation.top5WalletShare * 100).toFixed(1)}% of observed volume`, 'activity_features', observedAt, features.participation.top5WalletShare, 0.88)],
    });
  }

  if (features.concentration.topClusterVolumeShare >= 0.25) {
    signals.push({
      type: 'CLUSTER_CONCENTRATION',
      severity: features.concentration.topClusterVolumeShare >= 0.5 ? 'HIGH' : 'MEDIUM',
      dimension: 'COORDINATED',
      value: round(features.concentration.topClusterVolumeShare),
      confidence: 0.82,
      evidence: [evidence(`Largest observed wallet cluster represents ${(features.concentration.topClusterVolumeShare * 100).toFixed(1)}% of volume`, 'cluster_activity', observedAt, features.concentration.topClusterVolumeShare, 0.82)],
    });
  }

  if (features.transactionDistribution.repeatedSizeRatio >= 0.35) {
    signals.push({
      type: 'REPEATED_TRADE_SIZES',
      severity: features.transactionDistribution.repeatedSizeRatio >= 0.6 ? 'HIGH' : 'MEDIUM',
      dimension: 'AUTOMATED',
      value: round(features.transactionDistribution.repeatedSizeRatio),
      confidence: 0.8,
      evidence: [evidence(`${(features.transactionDistribution.repeatedSizeRatio * 100).toFixed(1)}% of trades fall into repeated-size bands`, 'activity_features', observedAt, features.transactionDistribution.repeatedSizeRatio, 0.8)],
    });
  }

  if (features.temporal.pattern === 'BURSTY' || features.temporal.pattern === 'PERIODIC' || features.temporal.pattern === 'CLUSTERED') {
    signals.push({
      type: 'TEMPORAL_PATTERN',
      severity: features.temporal.pattern === 'PERIODIC' ? 'MEDIUM' : 'LOW',
      dimension: features.temporal.pattern === 'PERIODIC' ? 'AUTOMATED' : 'COORDINATED',
      value: features.temporal.pattern,
      confidence: 0.76,
      evidence: [evidence(`Temporal distribution classified as ${features.temporal.pattern}`, 'activity_features', observedAt, features.temporal.burstScore, 0.76)],
    });
  }

  if (features.circularActivityScore >= 45) {
    signals.push({
      type: 'POTENTIAL_CIRCULAR_ACTIVITY',
      severity: features.circularActivityScore >= 75 ? 'HIGH' : 'MEDIUM',
      dimension: 'COORDINATED',
      value: features.circularActivityScore,
      confidence: 0.78,
      evidence: features.pairInteractions.slice(0, 3).flatMap((interaction) => interaction.evidence),
    });
  }

  if (features.botLikeScore >= 60) {
    signals.push({
      type: 'BOT_LIKE_ACTIVITY',
      severity: 'MEDIUM',
      dimension: 'AUTOMATED',
      value: features.botLikeScore,
      confidence: 0.74,
      evidence: [evidence(`Bot-like execution pattern score ${features.botLikeScore}/100`, 'activity_features', observedAt, features.botLikeScore, 0.74)],
    });
  }

  if (features.marketMakerLikeScore >= 70) {
    signals.push({
      type: 'MARKET_MAKER_LIKE_ACTIVITY',
      severity: 'INFO',
      dimension: 'UNKNOWN',
      value: features.marketMakerLikeScore,
      confidence: 0.72,
      evidence: [evidence(`Two-sided persistent activity resembles market-making behavior (${features.marketMakerLikeScore}/100)`, 'activity_features', observedAt, features.marketMakerLikeScore, 0.72)],
    });
  }

  if (features.creatorLinkedVolumeShare >= 0.1) {
    signals.push({
      type: 'CREATOR_LINKED_ACTIVITY',
      severity: features.creatorLinkedVolumeShare >= 0.3 ? 'HIGH' : 'MEDIUM',
      dimension: 'COORDINATED',
      value: round(features.creatorLinkedVolumeShare),
      confidence: 0.82,
      evidence: [evidence(`Creator-associated wallets represent ${(features.creatorLinkedVolumeShare * 100).toFixed(1)}% of observed volume`, 'creator_relationships', observedAt, features.creatorLinkedVolumeShare, 0.82)],
    });
  }

  return signals;
}

function computeOrganicConfidence(features: ActivityQualityFeatureSet): number {
  let confidence = features.dataCoverage * 100;
  if (features.sampleSize < 20) confidence *= 0.35;
  else if (features.sampleSize < 100) confidence *= 0.65;
  else if (features.sampleSize < 500) confidence *= 0.85;

  if (features.status === 'STALE') confidence *= 0.55;
  if (features.status === 'UNKNOWN') confidence *= 0.3;

  return Math.round(clamp(confidence));
}

function freshnessStatus(features: ActivityQualityFeatureSet): WindowAssessmentStatus {
  if (features.status === 'STALE') return 'STALE';
  if (features.sampleSize === 0) return 'UNKNOWN';
  if (features.status === 'INSUFFICIENT_DATA') return 'INSUFFICIENT_DATA';
  return 'AVAILABLE';
}

function interpretOrganicScore(score: number): string {
  if (score >= 90) return 'Activity appears highly diverse based on available evidence.';
  if (score >= 75) return 'Activity appears generally broad based on available evidence.';
  if (score >= 60) return 'Activity appears mixed, with both broad and concentrated signals.';
  if (score >= 40) return 'Activity shows elevated concentration or anomaly signals.';
  if (score >= 20) return 'Activity shows high observable concentration or anomaly signals.';
  return 'Activity shows severe observable concentration or anomaly signals.';
}

function choosePrimaryWindow(
  assessments: Partial<Record<ActivityWindow, OrganicActivityAssessment>>,
): ActivityWindow {
  const priority: ActivityWindow[] = ['1h', '4h', '24h', '15m', '5m', '1m', '7d'];
  return priority.find((window) => assessments[window]?.status === 'AVAILABLE') ?? '1h';
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
