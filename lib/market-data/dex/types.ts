/**
 * DEX Adapter Types & Interface (Sprint 45 §8-9).
 */

import { Market, ReserveState, SwapEvent, LiquidityEvent } from '../types';

export interface MarketCandidate {
  chainId: string;
  protocol: string;
  marketType: 'CPMM' | 'CONCENTRATED' | 'ORDERBOOK' | 'STABLE_SWAP';
  address: string;
  baseTokenId: string;
  quoteTokenId: string;
  feeBps: number;
  initialBaseReserve?: number;
  initialQuoteReserve?: number;
  slotOrBlock?: number;
  metadata?: Record<string, unknown>;
}

export interface MarketState {
  marketId: string;
  address: string;
  reserves: ReserveState;
  currentPriceUsd: number;
  feeBps: number;
  isActive: boolean;
  blockOrSlot: number;
}

export interface DexAdapter {
  readonly protocol: string;
  readonly chainId: string;

  discoverMarkets(fromBlock?: number): Promise<MarketCandidate[]>;
  getMarketState(marketAddress: string): Promise<MarketState>;
  getReserves(marketAddress: string): Promise<ReserveState>;
  getSwapEvents(marketAddress: string, since?: string): Promise<SwapEvent[]>;
  getLiquidityEvents(marketAddress: string, since?: string): Promise<LiquidityEvent[]>;
}
