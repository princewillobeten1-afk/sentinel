import { UnavailableTradingProvider } from './unavailable-provider';
import type { TradingProvider } from './provider';
import type { TradeHistoryRecord, TradeSimulationResult } from './types';
import type { Quote } from '@/lib/quote/types';

// Production must not report a simulated or fabricated confirmation. Inject a
// real provider during deployment; the default is an explicit unavailable state.
let provider: TradingProvider = new UnavailableTradingProvider();

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
