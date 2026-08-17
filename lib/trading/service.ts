import { MockTradingProvider } from './mock-provider';
import type { TradingProvider } from './provider';
import type { TradeHistoryRecord, TradeSimulationResult } from './types';
import type { Quote } from '@/lib/quote/types';

let provider: TradingProvider = new MockTradingProvider();

export function setTradingProvider(nextProvider: TradingProvider) {
  provider = nextProvider;
}

export async function simulateTradeExecution(
  quote: Quote,
  walletPublicKey: string,
  availableSol: number,
  network: string
): Promise<TradeSimulationResult> {
  return provider.simulateTrade({ quote, walletPublicKey, availableSol, network });
}

export async function submitTradeOrder(
  quote: Quote,
  walletPublicKey: string,
  signature: string,
  network: string,
  idempotencyKey: string
): Promise<TradeHistoryRecord> {
  return provider.submitTrade({ quote, walletPublicKey, signature, network, idempotencyKey });
}

export async function getTradeHistory(userId: string): Promise<TradeHistoryRecord[]> {
  return provider.getTradeHistory(userId);
}
