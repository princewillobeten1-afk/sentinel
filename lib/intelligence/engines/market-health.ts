/**
 * Market Health Intelligence Engine
 *
 * Analyzes price stability, volume, volume acceleration, tx activity,
 * buy/sell imbalance, liquidity, market-cap behavior, and trading consistency.
 *
 * Consumes TokenMarketData from Sprint 3.
 * Does NOT predict future price.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  DimensionStatus,
} from '../types';

const METHODOLOGY_VERSION = 'market-health-v1.0.0';

export interface MarketHealthInput {
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  volume1hUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  buysCount: number;
  sellsCount: number;
  holdersCount: number;
  volatility24h: number;
  averageTradeSizeUsd: number;
  buySellRatio: number;
  bidAskSpread: number;
  dataTimestamp: string;
}

export function analyzeMarketHealth(input: MarketHealthInput): EngineResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];

  // Track data completeness
  let dataPoints = 0;
  let availablePoints = 0;
  const totalExpected = 14;

  const checkData = (val: number | undefined | null, label: string): boolean => {
    dataPoints++;
    if (val != null && val !== 0 && !isNaN(val)) {
      availablePoints++;
      return true;
    }
    missingData.push({
      category: 'MARKET',
      description: `${label} unavailable`,
      impact: 'REDUCES_CONFIDENCE',
    });
    return false;
  };

  // ── Price Stability ──
  if (checkData(input.priceChange24h, 'Price change 24h')) {
    const absPriceChange = Math.abs(input.priceChange24h);
    evidence.push({
      fact: `Price changed ${input.priceChange24h >= 0 ? '+' : ''}${input.priceChange24h.toFixed(1)}% in 24h`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.priceChange24h,
      confidence: 0.95,
    });

    if (absPriceChange > 50) {
      signals.push(createSignal('PRICE_VOLATILITY', 'MARKET',
        absPriceChange > 100 ? 'HIGH' : 'MEDIUM',
        absPriceChange > 100 ? 'NEGATIVE' : 'NEUTRAL',
        `${input.priceChange24h.toFixed(1)}%`,
        0.92,
        [{ fact: `24h price change: ${input.priceChange24h.toFixed(1)}%`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.95 }],
        now
      ));
    } else if (absPriceChange < 10) {
      signals.push(createSignal('PRICE_STABILITY', 'MARKET',
        'INFO', 'POSITIVE',
        `${input.priceChange24h.toFixed(1)}%`,
        0.90,
        [{ fact: `Stable price movement: ${input.priceChange24h.toFixed(1)}% over 24h`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.95 }],
        now
      ));
    }
  }

  // ── Volume ──
  if (checkData(input.volume24hUsd, '24h volume')) {
    evidence.push({
      fact: `24h volume: $${formatNumber(input.volume24hUsd)}`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.volume24hUsd,
      confidence: 0.93,
    });

    // Volume-to-liquidity ratio
    if (input.liquidityUsd > 0) {
      const vlRatio = input.volume24hUsd / input.liquidityUsd;
      if (vlRatio > 5) {
        signals.push(createSignal('HIGH_VOLUME_LIQUIDITY_RATIO', 'MARKET',
          'INFO', 'POSITIVE',
          `${vlRatio.toFixed(1)}x`,
          0.88,
          [{ fact: `Volume/liquidity ratio: ${vlRatio.toFixed(1)}x — active trading relative to pool depth`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.88 }],
          now
        ));
      }
    }
  }

  // ── Volume Acceleration ──
  if (checkData(input.volume1hUsd, '1h volume') && checkData(input.volume24hUsd, '24h volume')) {
    const hourlyBaseline = input.volume24hUsd / 24;
    const acceleration = hourlyBaseline > 0 ? input.volume1hUsd / hourlyBaseline : 0;
    if (acceleration > 3) {
      signals.push(createSignal('VOLUME_ACCELERATION', 'MARKET',
        acceleration > 8 ? 'MEDIUM' : 'INFO',
        'NEUTRAL',
        `${acceleration.toFixed(1)}x`,
        0.85,
        [{ fact: `Current 1h volume is ${acceleration.toFixed(1)}x the 24h hourly average`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.85 }],
        now
      ));
    }
  }

  // ── Transaction Activity ──
  const totalTx = (input.buysCount || 0) + (input.sellsCount || 0);
  if (checkData(totalTx, 'Transaction count')) {
    evidence.push({
      fact: `${totalTx} transactions (${input.buysCount} buys, ${input.sellsCount} sells)`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: totalTx,
      confidence: 0.90,
    });

    if (totalTx > 1000) {
      signals.push(createSignal('ACTIVE_TRADING', 'MARKET',
        'INFO', 'POSITIVE',
        totalTx,
        0.88,
        [{ fact: `${totalTx} transactions observed — active market`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.90 }],
        now
      ));
    } else if (totalTx < 50) {
      signals.push(createSignal('LOW_ACTIVITY', 'MARKET',
        'LOW', 'NEGATIVE',
        totalTx,
        0.85,
        [{ fact: `Only ${totalTx} transactions — limited trading activity`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.90 }],
        now
      ));
    }
  }

  // ── Buy/Sell Imbalance ──
  if (checkData(input.buySellRatio, 'Buy/sell ratio')) {
    evidence.push({
      fact: `Buy/sell ratio: ${input.buySellRatio.toFixed(2)}`,
      source: 'market_data',
      observedAt: input.dataTimestamp,
      value: input.buySellRatio,
      confidence: 0.90,
    });

    if (input.buySellRatio > 3) {
      signals.push(createSignal('EXTREME_BUY_IMBALANCE', 'MARKET',
        'MEDIUM', 'NEUTRAL',
        input.buySellRatio,
        0.88,
        [{ fact: `Buy/sell ratio ${input.buySellRatio.toFixed(2)} — heavily buy-dominated`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.88 }],
        now
      ));
    } else if (input.buySellRatio < 0.33) {
      signals.push(createSignal('EXTREME_SELL_IMBALANCE', 'MARKET',
        'MEDIUM', 'NEGATIVE',
        input.buySellRatio,
        0.88,
        [{ fact: `Buy/sell ratio ${input.buySellRatio.toFixed(2)} — heavily sell-dominated`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.88 }],
        now
      ));
    }
  }

  // ── Bid/Ask Spread ──
  if (checkData(input.bidAskSpread, 'Bid/ask spread')) {
    if (input.bidAskSpread > 2) {
      signals.push(createSignal('WIDE_SPREAD', 'MARKET',
        'LOW', 'NEGATIVE',
        `${input.bidAskSpread.toFixed(2)}%`,
        0.90,
        [{ fact: `Bid/ask spread: ${input.bidAskSpread.toFixed(2)}% — wider than typical`, source: 'market_data', observedAt: input.dataTimestamp, confidence: 0.90 }],
        now
      ));
    }
  }

  // ── Market Cap ──
  checkData(input.marketCapUsd, 'Market cap');
  checkData(input.holdersCount, 'Holder count');
  checkData(input.volatility24h, 'Volatility 24h');
  checkData(input.averageTradeSizeUsd, 'Average trade size');
  checkData(input.priceUsd, 'Current price');
  checkData(input.priceChange1h, 'Price change 1h');
  checkData(input.liquidityUsd, 'Liquidity');

  // ── Score Calculation ──
  const dataCoverage = availablePoints / totalExpected;
  let score = 50; // baseline

  // Price stability contribution (+/- 15)
  const absPc = Math.abs(input.priceChange24h || 0);
  if (absPc < 10) score += 15;
  else if (absPc < 30) score += 8;
  else if (absPc < 50) score += 0;
  else if (absPc < 100) score -= 5;
  else score -= 15;

  // Volume contribution (+/- 10)
  if ((input.volume24hUsd || 0) > 1_000_000) score += 10;
  else if ((input.volume24hUsd || 0) > 100_000) score += 5;
  else if ((input.volume24hUsd || 0) < 10_000) score -= 10;

  // Activity contribution (+/- 10)
  if (totalTx > 1000) score += 10;
  else if (totalTx > 100) score += 5;
  else if (totalTx < 20) score -= 10;

  // Buy/sell balance (+/- 5)
  const bsr = input.buySellRatio || 1;
  if (bsr > 0.5 && bsr < 2) score += 5;
  else if (bsr > 3 || bsr < 0.33) score -= 5;

  // Spread (+/- 5)
  if ((input.bidAskSpread || 0) < 0.5) score += 5;
  else if ((input.bidAskSpread || 0) > 2) score -= 5;

  // Volatility (+/- 5)
  if ((input.volatility24h || 0) < 5) score += 5;
  else if ((input.volatility24h || 0) > 20) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const confidence = dataCoverage * 0.95;
  const level = scoreToStatus(score);

  const dimension: RiskDimension = {
    category: 'MARKET',
    score,
    level,
    confidence,
    evidence,
    signals,
    lastUpdated: now,
  };

  return { dimension, signals, missingData };
}

// ── Helpers ──

function scoreToStatus(score: number): DimensionStatus {
  if (score >= 75) return 'STRONG';
  if (score >= 55) return 'MODERATE';
  if (score >= 35) return 'ELEVATED';
  return 'UNKNOWN';
}

function createSignal(
  type: string,
  category: 'MARKET',
  severity: IntelligenceSignal['severity'],
  polarity: IntelligenceSignal['polarity'],
  value: string | number,
  confidence: number,
  evidence: Evidence[],
  now: string,
): IntelligenceSignal {
  return {
    id: `sig_mkt_${type.toLowerCase()}_${Date.now()}`,
    type,
    category,
    severity,
    polarity,
    value,
    confidence,
    evidence,
    observedAt: now,
    methodologyVersion: METHODOLOGY_VERSION,
    metadata: {},
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}
