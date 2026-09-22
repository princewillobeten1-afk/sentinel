import type { Quote } from '@/lib/quote/types';
import type { TradingProvider } from './provider';
import type { TradeHistoryRecord, TradeSimulationResult } from './types';

const UNAVAILABLE_MESSAGE =
  'On-chain swap execution is not configured. No transaction was signed or broadcast.';

export class UnavailableTradingProvider implements TradingProvider {
  async simulateTrade(_payload: {
    quote: Quote;
    walletPublicKey: string;
    availableSol: number;
    network: string;
  }): Promise<TradeSimulationResult> {
    return {
      valid: false,
      errors: [UNAVAILABLE_MESSAGE],
      warnings: [],
    };
  }

  async submitTrade(_payload: {
    quote: Quote;
    walletPublicKey: string;
    signature: string;
    network: string;
    idempotencyKey: string;
  }): Promise<TradeHistoryRecord> {
    throw new Error(UNAVAILABLE_MESSAGE);
  }

  async getTradeHistory(_userId: string): Promise<TradeHistoryRecord[]> {
    return [];
  }
}