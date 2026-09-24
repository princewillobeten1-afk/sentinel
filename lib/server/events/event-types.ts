/**
 * Normalized Real-Time Event Model (Project Sentinel Event Bus)
 *
 * Adheres to Section 5 of the Real-Time Solana Token Feed Specification.
 */

export const EVENT_TYPES = {
  TOKEN_CREATED: 'TOKEN_CREATED',
  POOL_CREATED: 'POOL_CREATED',
  LIQUIDITY_ADDED: 'LIQUIDITY_ADDED',
  BUY: 'BUY',
  SELL: 'SELL',
  TRANSFER: 'TRANSFER',
  MIGRATION: 'MIGRATION',
  TOKEN_UPDATE: 'TOKEN_UPDATE',
  WALLET_BUY: 'WALLET_BUY',
  WALLET_SELL: 'WALLET_SELL',
} as const;

export type RealtimeEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface EventLatencyMetrics {
  chainTimestamp?: number;
  receivedTimestamp: number;
  parsedTimestamp: number;
  publishedTimestamp?: number;
  websocketTimestamp?: number;
  totalDetectionLatencyMs?: number;
}

export interface NormalizedRealtimeEvent {
  id: string; // Provider-independent chain event identity.
  sequence: number; // Monotonically increasing sequence number
  type: RealtimeEventType;
  timestamp: number; // Unix milliseconds
  slot?: number;
  signature?: string;
  instructionIndex?: number;
  innerInstructionIndex?: number;
  mint?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  imageUrl?: string;
  wallet?: string;
  program?: string;
  pool?: string;
  dex?: string;
  amount?: number;
  amountSol?: number;
  amountUsd?: number;
  price?: number;
  priceUsd?: number;
  liquidityUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  source?: 'helius_laserstream' | 'helius_ws' | 'quicknode' | 'birdeye' | 'mock';
  commitment?: 'processed' | 'confirmed' | 'finalized';
  latency?: EventLatencyMetrics;
  extra?: Record<string, unknown>;
}

export interface TokenLifecycleState {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUrl?: string;
  launch?: {
    platform: string;
    slot?: number;
    signature?: string;
    firstSeenAt: string;
  };
  pool?: {
    address?: string;
    dex?: string;
    createdAt?: string;
  };
  market: {
    priceUsd: number;
    liquidityUsd: number;
    marketCapUsd: number;
    volume24hUsd: number;
    change24hPercent?: number;
  };
  activity: {
    buys: number;
    sells: number;
    uniqueBuyers: number;
    uniqueSellers: number;
    lastTradeAt?: string;
  };
  updatedAt: string;
}
