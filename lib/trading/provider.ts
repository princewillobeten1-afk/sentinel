import type { Quote } from '@/lib/quote/types';
import type { TradeHistoryRecord, TradeSimulationResult } from './types';

export interface TradingProvider {
  simulateTrade(payload: {
    quote: Quote;
    walletPublicKey: string;
    availableSol: number;
    network: string;
  }): Promise<TradeSimulationResult>;
  submitTrade(payload: {
    quote: Quote;
    walletPublicKey: string;
    signature: string;
    network: string;
    idempotencyKey: string;
  }): Promise<TradeHistoryRecord>;
  getTradeHistory(userId: string): Promise<TradeHistoryRecord[]>;
}
