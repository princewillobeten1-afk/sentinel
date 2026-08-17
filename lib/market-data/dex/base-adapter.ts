import { DexAdapter, MarketCandidate, MarketState } from './types';
import { ReserveState, SwapEvent, LiquidityEvent } from '../types';

export abstract class BaseDexAdapter implements DexAdapter {
  abstract readonly protocol: string;
  abstract readonly chainId: string;

  abstract discoverMarkets(fromBlock?: number): Promise<MarketCandidate[]>;
  abstract getMarketState(marketAddress: string): Promise<MarketState>;
  abstract getReserves(marketAddress: string): Promise<ReserveState>;
  abstract getSwapEvents(marketAddress: string, since?: string): Promise<SwapEvent[]>;
  abstract getLiquidityEvents(marketAddress: string, since?: string): Promise<LiquidityEvent[]>;

  /**
   * Helper to build a canonical deterministic market ID
   */
  protected buildMarketId(address: string): string {
    return `${this.chainId.toLowerCase()}:${this.protocol.toLowerCase()}:${address.toLowerCase()}`;
  }

  /**
   * Safe price computation from base and quote reserves with decimals
   */
  protected calculateCpmmPrice(
    baseReserve: number,
    quoteReserve: number,
    quotePriceUsd = 1.0
  ): number {
    if (baseReserve <= 0 || quoteReserve <= 0) return 0;
    return (quoteReserve / baseReserve) * quotePriceUsd;
  }
}
