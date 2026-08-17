import type { AmmKind, PoolQuote, PoolState, TradeSide } from '../types';

/**
 * Every AMM adapter implements the same surface so the routing and execution
 * layers can treat pools uniformly (spec §10). Adapters own the exact pool
 * mechanics — the engines never approximate with a generic formula when a
 * concrete adapter is available.
 */
export interface AmmAdapter {
  kind: AmmKind;
  getPoolState(pool: PoolState): PoolState;
  quoteBuy(pool: PoolState, inputUsd: number): PoolQuote;
  quoteSell(pool: PoolState, inputUsd: number): PoolQuote;
  estimateImpact(pool: PoolState, side: TradeSide, inputUsd: number): number;
  /** Usable (immediately executable) liquidity near current price, in USD. */
  usableLiquidityUsd(pool: PoolState): number;
}
