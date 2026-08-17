/**
 * `ITradingRouter` / `IDexAdapter` — spec §25-28 (router, external DEX
 * integration, slippage protection, deadline protection).
 *
 * The platform routes trades through the best available liquidity rather
 * than forcing proprietary liquidity (spec §25) — `ITradingRouter` is
 * adapter-based specifically so a `BondingCurve` pool is just one more
 * `IDexAdapter` among several, not a mandatory hop.
 *
 * `dexId` vocabulary matches `db/migrations/013_production_data_model.sql`'s
 * `dexes.protocol` column values (`'raydium_clmm'`, `'orca_whirlpool'`,
 * `'uniswap_v3'`, `'meteora_dlmm'`) — an adapter implementation registers
 * under one of these, not an invented name.
 */

import type { Address, BigNumberish, TxSignature } from './types';

export interface DexQuote {
  dex: string;
  inputAmount: BigNumberish;
  outputAmount: BigNumberish;
  priceImpact: number;
  route: Address[];
}

export interface IDexAdapter {
  readonly dexId: string;
  getQuote(tokenIn: Address, tokenOut: Address, amountIn: BigNumberish): Promise<DexQuote>;

  /** `minAmountOut` is spec §27's slippage-protection floor — a real implementation must reject a swap that would settle below it, not just warn. */
  buildSwapInstruction(quote: DexQuote, minAmountOut: BigNumberish, trader: Address): Promise<{ txSignature: TxSignature }>;
}

export interface ITradingRouter {
  registerAdapter(adapter: IDexAdapter): void;
  getBestQuote(tokenIn: Address, tokenOut: Address, amountIn: BigNumberish): Promise<DexQuote>;

  /** `deadline` (spec §28) is intentionally required, not optional — a stale quote executing later at a worse price is exactly what deadline protection exists to prevent. */
  executeSwap(quote: DexQuote, minAmountOut: BigNumberish, trader: Address, deadline: number): Promise<{ txSignature: TxSignature }>;

  listAdapters(): string[];
}
