import type { Quote } from '@/lib/quote/types';

export type TradeQuote = Quote;

export interface TradeQuoteRequest {
  symbol: string;
  side: 'buy' | 'sell';
  amountSol: number;
  slippageTolerance: number;
  type: 'market' | 'limit';
}

export interface TradeSimulationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  transactionPayload?: Uint8Array;
  simulatedTxHash?: string;
  idempotencyKey?: string;
}

export type TransactionExecutionState =
  | 'idle'
  | 'preparing'
  | 'awaitingWallet'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'rejected'
  | 'failed'
  | 'expired'
  | 'dropped'
  | 'unknown';

export interface TradeHistoryRecord {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amountSol: number;
  receivedTokens: number;
  priceUsd: number;
  status: 'confirmed' | 'pending' | 'failed' | 'rejected' | 'expired' | 'dropped' | 'unknown';
  executedAt: string;
  txHash: string;
}
