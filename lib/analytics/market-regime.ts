/**
 * Market Regime Classifier (Sprint 38 §45).
 *
 * Classifies broader network market conditions:
 *   - HIGH_LIQUIDITY
 *   - LOW_LIQUIDITY
 *   - HIGH_VOLATILITY
 *   - RISK_ON
 *   - RISK_OFF
 *   - MEME_FRENZY
 *   - BROAD_SELLOFF
 */

import { MarketRegimeStatus, MarketRegimeType } from './types';

export interface NetworkMarketMetrics {
  activeSolanaVolume24hUsd: number;
  newMintsCount24h: number;
  medianPoolDepthUsd: number;
  averageWashTradingPct: number;
  advanceDeclineRatio: number; // Ratio of gainers vs losers
  solanaPriceChange24hPct: number;
}

export class MarketRegimeClassifier {
  /**
   * Classifies network market regime from aggregate on-chain telemetry.
   */
  public static classifyRegime(metrics: NetworkMarketMetrics): MarketRegimeStatus {
    let regime: MarketRegimeType = 'RISK_ON';
    let confidenceScore = 85;

    if (metrics.newMintsCount24h > 1500 && metrics.activeSolanaVolume24hUsd > 100_000_000) {
      regime = 'MEME_FRENZY';
      confidenceScore = 94;
    } else if (metrics.solanaPriceChange24hPct < -8.0 && metrics.advanceDeclineRatio < 0.4) {
      regime = 'BROAD_SELLOFF';
      confidenceScore = 92;
    } else if (metrics.medianPoolDepthUsd > 300_000 && metrics.activeSolanaVolume24hUsd > 50_000_000) {
      regime = 'HIGH_LIQUIDITY';
      confidenceScore = 88;
    } else if (metrics.medianPoolDepthUsd < 50_000) {
      regime = 'LOW_LIQUIDITY';
      confidenceScore = 90;
    } else if (metrics.advanceDeclineRatio > 1.8) {
      regime = 'RISK_ON';
      confidenceScore = 86;
    } else {
      regime = 'RISK_OFF';
      confidenceScore = 80;
    }

    return {
      regime,
      confidenceScore,
      activeSolanaVolume24hUsd: metrics.activeSolanaVolume24hUsd,
      newMintsCount24h: metrics.newMintsCount24h,
      medianPoolDepthUsd: metrics.medianPoolDepthUsd,
      averageWashTradingPct: metrics.averageWashTradingPct,
      updatedAt: new Date().toISOString(),
    };
  }
}
