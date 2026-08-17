/**
 * Canonical Liquidity Engine (Sprint 45 §23-26, §63).
 *
 * Computes reserve USD equivalent values, aggregated token liquidity across quality pools,
 * pool concentration metrics, and liquidity drop anomaly detection.
 */

import { canonicalMarketRegistry } from '../discovery/market-registry';
import { ReserveState } from '../types';

export interface TokenLiquiditySummary {
  tokenId: string;
  totalLiquidityUsd: number;
  marketCount: number;
  largestMarketId: string;
  largestMarketLiquidityUsd: number;
  concentrationPct: number; // % of total liquidity in largest pool
  confidence: number;
  anomalyDetected: boolean;
  timestamp: string;
}

export class LiquidityEngine {
  private static instance: LiquidityEngine;
  private marketReserves: Map<string, ReserveState> = new Map();
  private previousTokenLiquidity: Map<string, { liquidityUsd: number; timestamp: number }> = new Map();

  private constructor() {
    this.seedDefaultReserves();
  }

  public static getInstance(): LiquidityEngine {
    if (!LiquidityEngine.instance) {
      LiquidityEngine.instance = new LiquidityEngine();
    }
    return LiquidityEngine.instance;
  }

  private seedDefaultReserves(): void {
    const now = new Date().toISOString();

    // Raydium Pool Reserve
    this.setMarketReserve({
      marketId: 'solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2',
      baseReserve: 15420.5,
      quoteReserve: 2_313_075.0,
      basePriceUsd: 150.0,
      quotePriceUsd: 1.0,
      liquidityUsd: 4_626_150.0,
      slotOrBlock: 284910200,
      timestamp: now,
    });

    // Orca Pool Reserve
    this.setMarketReserve({
      marketId: 'solana:orca_whirlpool:7xk9orcawhirlpoolpoolsentusdc99a12',
      baseReserve: 6160.0,
      quoteReserve: 925_000.0,
      basePriceUsd: 150.15,
      quotePriceUsd: 1.0,
      liquidityUsd: 1_850_000.0,
      slotOrBlock: 284910190,
      timestamp: now,
    });

    // Meteora Pool Reserve
    this.setMarketReserve({
      marketId: 'solana:meteora:9pw2meteorapoolsentusdt44c1',
      baseReserve: 2736.0,
      quoteReserve: 410_000.0,
      basePriceUsd: 149.85,
      quotePriceUsd: 1.0,
      liquidityUsd: 820_000.0,
      slotOrBlock: 284910180,
      timestamp: now,
    });
  }

  public setMarketReserve(reserve: ReserveState): void {
    this.marketReserves.set(reserve.marketId.toLowerCase(), reserve);
  }

  public getMarketReserve(marketId: string): ReserveState | undefined {
    return this.marketReserves.get(marketId.toLowerCase());
  }

  /**
   * Calculates total USD liquidity for a pair given token reserves and unit prices
   */
  public calculateMarketLiquidity(
    baseReserve: number,
    quoteReserve: number,
    basePriceUsd: number,
    quotePriceUsd: number
  ): number {
    if (baseReserve < 0 || quoteReserve < 0 || basePriceUsd < 0 || quotePriceUsd < 0) return 0;
    return baseReserve * basePriceUsd + quoteReserve * quotePriceUsd;
  }

  /**
   * Aggregates total token liquidity across all verified active markets
   */
  public getTokenLiquidity(tokenId: string): TokenLiquiditySummary {
    const markets = canonicalMarketRegistry.getMarketsForToken(tokenId);
    const activeMarkets = markets.filter((m) => m.status === 'ACTIVE');

    let totalLiquidityUsd = 0;
    let largestMarketId = '';
    let largestMarketLiquidityUsd = 0;
    let count = 0;

    for (const m of activeMarkets) {
      const r = this.getMarketReserve(m.marketId);
      if (r && r.liquidityUsd > 0) {
        totalLiquidityUsd += r.liquidityUsd;
        count++;
        if (r.liquidityUsd > largestMarketLiquidityUsd) {
          largestMarketLiquidityUsd = r.liquidityUsd;
          largestMarketId = m.marketId;
        }
      }
    }

    const concentrationPct =
      totalLiquidityUsd > 0 ? (largestMarketLiquidityUsd / totalLiquidityUsd) * 100 : 0;

    // Check for sudden liquidity drop anomaly (>40% drop within 15 min)
    const prev = this.previousTokenLiquidity.get(tokenId);
    let anomalyDetected = false;
    if (prev && Date.now() - prev.timestamp <= 900000) {
      if (prev.liquidityUsd > 10000 && totalLiquidityUsd < prev.liquidityUsd * 0.6) {
        anomalyDetected = true;
      }
    }

    // Save current for next delta check
    this.previousTokenLiquidity.set(tokenId, {
      liquidityUsd: totalLiquidityUsd,
      timestamp: Date.now(),
    });

    const confidence = count > 0 ? (totalLiquidityUsd > 50000 ? 0.98 : 0.85) : 0;

    return {
      tokenId,
      totalLiquidityUsd,
      marketCount: count,
      largestMarketId,
      largestMarketLiquidityUsd,
      concentrationPct: parseFloat(concentrationPct.toFixed(2)),
      confidence,
      anomalyDetected,
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.marketReserves.clear();
    this.previousTokenLiquidity.clear();
    this.seedDefaultReserves();
  }
}

export const liquidityEngine = LiquidityEngine.getInstance();
