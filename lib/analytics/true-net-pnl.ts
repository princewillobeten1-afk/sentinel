/**
 * True Net P&L & Friction Cost Attribution Engine (Sprint 38 §32-33).
 *
 * Implements comprehensive true P&L accounting:
 *   Gross Profit
 *   - DEX Trading Fees (e.g. 0.25% pool fee)
 *   - Solana Network Gas & Priority Fees
 *   - Execution Slippage Loss
 *   - Price Impact Decay
 *   = TRUE NET P&L
 */

import { TrueNetPnlBreakdown } from './types';

export interface RawTradeExecutionRecord {
  tradeId: string;
  tokenSymbol: string;
  entryPriceUsd: number;
  exitPriceUsd: number;
  positionSizeUsd: number;
  dexFeeBps?: number; // e.g. 25 bps = 0.25%
  networkGasSol?: number;
  solPriceUsd?: number;
  realizedSlippagePct?: number;
  realizedPriceImpactPct?: number;
}

export class TrueNetPnlEngine {
  /**
   * Computes exact net P&L after all frictions.
   */
  public static calculateTrueNetPnl(trade: RawTradeExecutionRecord): TrueNetPnlBreakdown {
    const rawPriceChangeRatio = (trade.exitPriceUsd - trade.entryPriceUsd) / trade.entryPriceUsd;
    const grossProfitUsd = Number((rawPriceChangeRatio * trade.positionSizeUsd).toFixed(2));

    // 1. DEX Trading Fees (Buy + Sell entry/exit)
    const dexFeeRate = (trade.dexFeeBps || 25) / 10000;
    const dexTradingFeesUsd = Number((trade.positionSizeUsd * dexFeeRate * 2).toFixed(2));

    // 2. Solana Network Gas Fees
    const solPrice = trade.solPriceUsd || 140;
    const gasSol = trade.networkGasSol || 0.00005; // standard ~0.00005 SOL
    const networkGasFeesUsd = Number((gasSol * 2 * solPrice).toFixed(4));

    // 3. Slippage Cost
    const slippagePct = trade.realizedSlippagePct || 0.5;
    const slippageCostUsd = Number((trade.positionSizeUsd * (slippagePct / 100)).toFixed(2));

    // 4. Price Impact Cost
    const impactPct = trade.realizedPriceImpactPct || 0.8;
    const priceImpactCostUsd = Number((trade.positionSizeUsd * (impactPct / 100)).toFixed(2));

    const totalFrictionCostsUsd = Number(
      (dexTradingFeesUsd + networkGasFeesUsd + slippageCostUsd + priceImpactCostUsd).toFixed(2)
    );

    const netPnlUsd = Number((grossProfitUsd - totalFrictionCostsUsd).toFixed(2));
    const netPnlPct = Number(((netPnlUsd / trade.positionSizeUsd) * 100).toFixed(2));

    return {
      tradeId: trade.tradeId,
      tokenSymbol: trade.tokenSymbol,
      grossProfitUsd,
      dexTradingFeesUsd,
      networkGasFeesUsd,
      slippageCostUsd,
      priceImpactCostUsd,
      totalFrictionCostsUsd,
      netPnlUsd,
      netPnlPct,
      realizedAt: new Date().toISOString(),
    };
  }
}
