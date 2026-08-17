/**
 * Canonical Price Engine (Sprint 45 §17-22, §62, §88).
 *
 * Implements pool price calculation, multi-market quality-weighted aggregation,
 * source ranking, stale price detection, and cross-market price divergence detection.
 */

import { canonicalMarketRegistry } from '../discovery/market-registry';
import { MarketPrice, CanonicalTokenPrice, DivergenceStatus } from '../types';

export class PriceEngine {
  private static instance: PriceEngine;
  private marketPrices: Map<string, MarketPrice> = new Map();
  private staleThresholdSeconds = 300; // 5 minutes

  private constructor() {
    this.seedDefaultPrices();
  }

  public static getInstance(): PriceEngine {
    if (!PriceEngine.instance) {
      PriceEngine.instance = new PriceEngine();
    }
    return PriceEngine.instance;
  }

  private seedDefaultPrices(): void {
    const now = new Date().toISOString();

    // Raydium SOL/USDC Market
    this.setMarketPrice({
      marketId: 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2',
      priceUsd: 150.0,
      status: 'FRESH',
      source: 'ONCHAIN_RESERVES',
      confidence: 0.99,
      liquidityUsd: 4_626_150,
      volume24hUsd: 48_250_000,
      timestamp: now,
    });

    // Orca SOL/USDC Market
    this.setMarketPrice({
      marketId: 'solana:orca_whirlpool:7xk9orcawhirlpoolpoolsentusdc99a12',
      priceUsd: 150.15,
      status: 'FRESH',
      source: 'ONCHAIN_TICKS',
      confidence: 0.98,
      liquidityUsd: 1_850_000,
      volume24hUsd: 12_400_000,
      timestamp: now,
    });

    // Meteora SOL/USDT Market
    this.setMarketPrice({
      marketId: 'solana:meteora:9pw2meteorapoolsentusdt44c1',
      priceUsd: 149.85,
      status: 'FRESH',
      source: 'ONCHAIN_DLMM',
      confidence: 0.95,
      liquidityUsd: 820_000,
      volume24hUsd: 4_800_000,
      timestamp: now,
    });
  }

  public setMarketPrice(price: MarketPrice): void {
    this.marketPrices.set(price.marketId.toLowerCase(), price);
  }

  public getMarketPrice(marketId: string): MarketPrice | undefined {
    const p = this.marketPrices.get(marketId.toLowerCase());
    if (!p) return undefined;

    // Evaluate staleness
    const ageSeconds = (Date.now() - new Date(p.timestamp).getTime()) / 1000;
    const isStale = ageSeconds > this.staleThresholdSeconds;

    return {
      ...p,
      status: isStale ? 'STALE' : 'FRESH',
    };
  }

  /**
   * Calculate market price from CPMM reserves
   */
  public calculateCpmmPrice(
    baseReserve: number,
    quoteReserve: number,
    quotePriceUsd = 1.0
  ): number {
    if (baseReserve <= 0 || quoteReserve <= 0) return 0;
    return (quoteReserve / baseReserve) * quotePriceUsd;
  }

  /**
   * Evaluates price divergence across multiple markets
   */
  public evaluateDivergence(prices: number[]): {
    divergencePct: number;
    status: DivergenceStatus;
  } {
    if (prices.length <= 1) {
      return { divergencePct: 0, status: 'NORMAL' };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min <= 0) return { divergencePct: 0, status: 'NORMAL' };

    const divergencePct = ((max - min) / min) * 100;

    let status: DivergenceStatus = 'NORMAL';
    if (divergencePct > 5.0) {
      status = 'ANOMALOUS';
    } else if (divergencePct > 2.0) {
      status = 'WARNING';
    }

    return { divergencePct, status };
  }

  /**
   * Computes canonical token price across all associated markets using
   * liquidity and volume-weighted quality aggregation.
   */
  public getCanonicalTokenPrice(tokenId: string): CanonicalTokenPrice {
    const markets = canonicalMarketRegistry.getMarketsForToken(tokenId);
    const activeMarkets = markets.filter((m) => m.status === 'ACTIVE' || m.status === 'DISCOVERED');

    if (activeMarkets.length === 0) {
      return {
        tokenId,
        priceUsd: 0,
        confidence: 0,
        marketCount: 0,
        dominantMarketId: '',
        divergenceStatus: 'NORMAL',
        sourceMarkets: [],
        calculationVersion: 'v1.0-weighted-quality',
        timestamp: new Date().toISOString(),
      };
    }

    const validPrices: Array<{
      marketId: string;
      priceUsd: number;
      weight: number;
      isFresh: boolean;
    }> = [];

    for (const m of activeMarkets) {
      const p = this.getMarketPrice(m.marketId);
      if (p && p.priceUsd > 0) {
        // Quality Weight Formula: ln(1 + Liquidity) * sqrt(1 + Volume24h) * Confidence
        const liqFactor = Math.log(1 + Math.max(0, p.liquidityUsd));
        const volFactor = Math.sqrt(1 + Math.max(0, p.volume24hUsd));
        const freshnessPenalty = p.status === 'STALE' ? 0.3 : 1.0;
        const weight = Math.max(0.0001, liqFactor * volFactor * p.confidence * freshnessPenalty);

        validPrices.push({
          marketId: m.marketId,
          priceUsd: p.priceUsd,
          weight,
          isFresh: p.status === 'FRESH',
        });
      }
    }

    if (validPrices.length === 0) {
      return {
        tokenId,
        priceUsd: 0,
        confidence: 0,
        marketCount: activeMarkets.length,
        dominantMarketId: activeMarkets[0].marketId,
        divergenceStatus: 'NORMAL',
        sourceMarkets: [],
        calculationVersion: 'v1.0-weighted-quality',
        timestamp: new Date().toISOString(),
      };
    }

    // Sort by weight descending
    validPrices.sort((a, b) => b.weight - a.weight);
    const dominantMarketId = validPrices[0].marketId;

    const totalWeight = validPrices.reduce((acc, curr) => acc + curr.weight, 0);
    const weightedPriceSum = validPrices.reduce((acc, curr) => acc + curr.priceUsd * curr.weight, 0);
    const canonicalPrice = weightedPriceSum / totalWeight;

    // Divergence evaluation
    const { status: divergenceStatus } = this.evaluateDivergence(validPrices.map((v) => v.priceUsd));

    // Base confidence score
    const freshRatio = validPrices.filter((v) => v.isFresh).length / validPrices.length;
    const confidence = Math.min(1.0, Math.max(0.1, freshRatio * (divergenceStatus === 'ANOMALOUS' ? 0.6 : 0.98)));

    return {
      tokenId,
      priceUsd: canonicalPrice,
      confidence: parseFloat(confidence.toFixed(3)),
      marketCount: validPrices.length,
      dominantMarketId,
      divergenceStatus,
      sourceMarkets: validPrices.map((v) => ({
        marketId: v.marketId,
        priceUsd: v.priceUsd,
        weight: parseFloat((v.weight / totalWeight).toFixed(4)),
      })),
      calculationVersion: 'v1.0-weighted-quality',
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.marketPrices.clear();
    this.seedDefaultPrices();
  }
}

export const priceEngine = PriceEngine.getInstance();
