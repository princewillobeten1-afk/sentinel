/**
 * Market Data Quality & Integrity Engine (Sprint 45 §60-65).
 *
 * Evaluates market freshness, liquidity health, volume consistency, source reliability,
 * and price divergence to output dataQualityScore (0-100) and dataConfidence (0.0-1.0).
 */

import { priceEngine } from '../pricing/price-engine';
import { liquidityEngine } from '../liquidity/liquidity-engine';
import { volumeEngine } from '../volume/volume-engine';
import { canonicalMarketRegistry } from '../discovery/market-registry';
import { MarketDataQualityReport } from '../types';

export class MarketDataQualityService {
  private static instance: MarketDataQualityService;

  private constructor() {}

  public static getInstance(): MarketDataQualityService {
    if (!MarketDataQualityService.instance) {
      MarketDataQualityService.instance = new MarketDataQualityService();
    }
    return MarketDataQualityService.instance;
  }

  public evaluateTokenQuality(tokenId: string): MarketDataQualityReport {
    const markets = canonicalMarketRegistry.getMarketsForToken(tokenId);
    const activeMarkets = markets.filter((m) => m.status === 'ACTIVE');
    const priceData = priceEngine.getCanonicalTokenPrice(tokenId);
    const liqData = liquidityEngine.getTokenLiquidity(tokenId);

    let freshnessScore = 100;
    let marketCoverageScore = 100;
    const anomaliesDetected: Array<'LIQUIDITY_DROP' | 'VOLUME_SPIKE' | 'PRICE_DISCONNECT' | 'STALE_FEED'> = [];

    // 1. Check Freshness
    let staleCount = 0;
    for (const m of activeMarkets) {
      const p = priceEngine.getMarketPrice(m.marketId);
      if (!p || p.status === 'STALE') {
        staleCount++;
      }
    }
    if (activeMarkets.length > 0 && staleCount === activeMarkets.length) {
      freshnessScore = 30;
      anomaliesDetected.push('STALE_FEED');
    } else if (staleCount > 0) {
      freshnessScore = 75;
    }

    // 2. Check Market Coverage & Liquidity Depth
    if (activeMarkets.length === 0) {
      marketCoverageScore = 0;
    } else if (liqData.totalLiquidityUsd < 1000) {
      marketCoverageScore = 40;
    } else if (liqData.totalLiquidityUsd < 25000) {
      marketCoverageScore = 70;
    }

    // 3. Check Anomalies
    if (liqData.anomalyDetected) {
      anomaliesDetected.push('LIQUIDITY_DROP');
    }

    // Check volume spike across markets
    for (const m of activeMarkets) {
      const vol = volumeEngine.getVolumeSummary(m.marketId);
      if (vol.volumeSpikeAnomaly) {
        if (!anomaliesDetected.includes('VOLUME_SPIKE')) {
          anomaliesDetected.push('VOLUME_SPIKE');
        }
      }
    }

    if (priceData.divergenceStatus === 'ANOMALOUS') {
      anomaliesDetected.push('PRICE_DISCONNECT');
    }

    // Calculate final composite quality score (0 - 100)
    let penalty = 0;
    if (anomaliesDetected.includes('PRICE_DISCONNECT')) penalty += 25;
    if (anomaliesDetected.includes('LIQUIDITY_DROP')) penalty += 20;
    if (anomaliesDetected.includes('STALE_FEED')) penalty += 35;
    if (anomaliesDetected.includes('VOLUME_SPIKE')) penalty += 10;

    const baseScore = freshnessScore * 0.4 + marketCoverageScore * 0.6;
    const dataQualityScore = Math.max(10, Math.min(100, Math.round(baseScore - penalty)));
    const dataConfidence = parseFloat((dataQualityScore / 100).toFixed(2));

    return {
      tokenId,
      dataQualityScore,
      dataConfidence,
      freshnessScore,
      marketCoverageScore,
      divergenceStatus: priceData.divergenceStatus,
      anomaliesDetected,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }
}

export const marketDataQualityService = MarketDataQualityService.getInstance();
