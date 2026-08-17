/**
 * Activity Quality Intelligence Engine
 *
 * Analyzes transaction distribution, repeated transactions, wallet concentration,
 * timing patterns, buy/sell distribution, and volume concentration.
 *
 * Output says "Activity quality: Low / Moderate / High confidence"
 * rather than claiming "This volume is fake."
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
  ActivityQuality,
} from '../types';

const METHODOLOGY_VERSION = 'activity-v1.0.0';

export interface ActivityInput {
  totalTransactions: number;
  uniqueWallets: number;
  repeatWalletRatio: number; // 0.0 – 1.0 (fraction of txs from repeat wallets)
  topWalletTxShare: number; // 0.0 – 1.0 (% of txs from top wallet)
  buysCount: number;
  sellsCount: number;
  avgTxSizeUsd: number;
  txSizeStdDev: number;
  volumeConcentration: number; // 0.0 – 1.0 (how concentrated volume is)
  temporalClustering: number; // 0.0 – 1.0 (how bunched in time)
  dataTimestamp: string;
}

export interface ActivityResult extends EngineResult {
  activityQuality: ActivityQuality;
}

export function analyzeActivity(input: ActivityInput): ActivityResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];
  let dataAvail = 0;
  const totalChecks = 10;

  const chk = (v: number | undefined, label: string): boolean => {
    if (v != null && !isNaN(v)) { dataAvail++; return true; }
    missingData.push({ category: 'ACTIVITY', description: `${label} unavailable`, impact: 'REDUCES_CONFIDENCE' });
    return false;
  };

  // ── Transaction Distribution ──
  if (chk(input.totalTransactions, 'Transaction count')) {
    evidence.push({
      fact: `${input.totalTransactions} total transactions`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.totalTransactions,
      confidence: 0.90,
    });
  }

  // ── Unique Wallets ──
  if (chk(input.uniqueWallets, 'Unique wallets')) {
    const walletsPerTx = input.totalTransactions > 0 ? input.uniqueWallets / input.totalTransactions : 0;
    evidence.push({
      fact: `${input.uniqueWallets} unique wallets (${(walletsPerTx * 100).toFixed(1)}% of txs)`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.uniqueWallets,
      confidence: 0.88,
    });

    if (input.uniqueWallets > 500) {
      signals.push(mkSig('DIVERSE_WALLETS', 'INFO', 'POSITIVE',
        input.uniqueWallets, 0.88,
        [{ fact: `${input.uniqueWallets} unique wallets — diverse participation`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.88 }], now));
    }
  }

  // ── Repeat Wallet Ratio ──
  if (chk(input.repeatWalletRatio, 'Repeat wallet ratio')) {
    evidence.push({
      fact: `Repeat wallet ratio: ${(input.repeatWalletRatio * 100).toFixed(1)}%`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.repeatWalletRatio,
      confidence: 0.87,
    });

    if (input.repeatWalletRatio > 0.7) {
      signals.push(mkSig('HIGH_REPEAT_WALLETS', 'MEDIUM', 'NEGATIVE',
        `${(input.repeatWalletRatio * 100).toFixed(0)}%`, 0.85,
        [{ fact: `${(input.repeatWalletRatio * 100).toFixed(0)}% of transactions from repeat wallets — concentrated activity`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.85 }], now));
    }
  }

  // ── Top Wallet Concentration ──
  if (chk(input.topWalletTxShare, 'Top wallet TX share')) {
    if (input.topWalletTxShare > 0.3) {
      signals.push(mkSig('TX_CONCENTRATION', 'MEDIUM', 'NEGATIVE',
        `${(input.topWalletTxShare * 100).toFixed(0)}%`, 0.88,
        [{ fact: `Single wallet accounts for ${(input.topWalletTxShare * 100).toFixed(0)}% of transactions`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.88 }], now));
    }
  }

  // ── Buy/Sell Distribution ──
  if (chk(input.buysCount, 'Buy count') && chk(input.sellsCount, 'Sell count')) {
    const total = input.buysCount + input.sellsCount;
    const buyPct = total > 0 ? (input.buysCount / total) * 100 : 50;
    evidence.push({
      fact: `Buy/sell split: ${buyPct.toFixed(0)}% buys / ${(100 - buyPct).toFixed(0)}% sells`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      confidence: 0.90,
    });
  }

  // ── Volume Concentration ──
  if (chk(input.volumeConcentration, 'Volume concentration')) {
    if (input.volumeConcentration > 0.7) {
      signals.push(mkSig('VOLUME_CONCENTRATION', 'MEDIUM', 'NEGATIVE',
        `${(input.volumeConcentration * 100).toFixed(0)}%`, 0.86,
        [{ fact: `Volume concentrated among few participants: ${(input.volumeConcentration * 100).toFixed(0)}%`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.86 }], now));
    }
  }

  // ── Temporal Clustering ──
  if (chk(input.temporalClustering, 'Temporal clustering')) {
    if (input.temporalClustering > 0.8) {
      signals.push(mkSig('TEMPORAL_CLUSTERING', 'LOW', 'NEGATIVE',
        `${(input.temporalClustering * 100).toFixed(0)}%`, 0.80,
        [{ fact: `Trading activity is temporally clustered: ${(input.temporalClustering * 100).toFixed(0)}%`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.80 }], now));
    }
  }

  chk(input.avgTxSizeUsd, 'Avg TX size');
  chk(input.txSizeStdDev, 'TX size std dev');

  // ── Quality Assessment ──
  let qualityScore = 0;
  if (input.uniqueWallets > 200) qualityScore++;
  if (input.repeatWalletRatio < 0.5) qualityScore++;
  if (input.topWalletTxShare < 0.15) qualityScore++;
  if (input.volumeConcentration < 0.5) qualityScore++;
  if (input.temporalClustering < 0.5) qualityScore++;

  let activityQuality: ActivityQuality;
  if (qualityScore >= 4) activityQuality = 'HIGH';
  else if (qualityScore >= 2) activityQuality = 'MODERATE';
  else if (dataAvail < 4) activityQuality = 'UNKNOWN';
  else activityQuality = 'LOW';

  // ── Score ──
  let score = 50;
  score += qualityScore * 8; // up to +40
  if (input.repeatWalletRatio > 0.7) score -= 15;
  if (input.topWalletTxShare > 0.3) score -= 10;
  if (input.volumeConcentration > 0.7) score -= 10;

  score = Math.max(0, Math.min(100, score));
  const confidence = (dataAvail / totalChecks) * 0.88;
  const level = sToStatus(score);

  return {
    dimension: { category: 'ACTIVITY', score, level, confidence, evidence, signals, lastUpdated: now },
    signals,
    missingData,
    activityQuality,
  };
}

function sToStatus(s: number): DimensionStatus {
  if (s >= 75) return 'STRONG';
  if (s >= 55) return 'MODERATE';
  if (s >= 35) return 'ELEVATED';
  return 'UNKNOWN';
}

function mkSig(
  type: string, severity: IntelligenceSignal['severity'],
  polarity: IntelligenceSignal['polarity'], value: string | number,
  confidence: number, evidence: Evidence[], now: string,
): IntelligenceSignal {
  return {
    id: `sig_act_${type.toLowerCase()}_${Date.now()}`,
    type, category: 'ACTIVITY', severity, polarity, value, confidence,
    evidence, observedAt: now, methodologyVersion: METHODOLOGY_VERSION, metadata: {},
  };
}
