/**
 * Multi-Chain Core Types & Domain Models (Sprint 44 §2-8, §16-18, §29-30).
 *
 * Defines unified types across Solana, Ethereum, Base, and future networks:
 *   - Universal Chain IDs & Finality states
 *   - Normalized Block, Transaction, and Event models
 *   - Token & Native balance abstractions
 *   - RPC Provider health, telemetry, and request tracing
 */

export type SupportedChain = 'solana' | 'ethereum' | 'base' | string;

export type BlockStatus = 'CANONICAL' | 'ORPHANED' | 'PENDING';
export type FinalityStatus = 'CONFIRMED' | 'FINALIZED';
export type ProviderHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';

export interface BlockModel {
  id: string;
  chainId: SupportedChain;
  number: number; // Block number or Solana slot
  hash: string;
  parentHash: string;
  timestamp: number; // Unix epoch ms
  status: BlockStatus;
  finality: FinalityStatus;
  transactionCount: number;
  metadata?: Record<string, any>;
  createdAt: number;
}

export type TransactionClassificationType =
  | 'TRANSFER'
  | 'SWAP'
  | 'LIQUIDITY_ADD'
  | 'LIQUIDITY_REMOVE'
  | 'MINT'
  | 'BURN'
  | 'CONTRACT_INTERACTION'
  | 'UNKNOWN';

export interface TransactionClassification {
  type: TransactionClassificationType;
  confidence: number; // 0.0 - 1.0
  source: string;
  version: string;
}

export interface NormalizedTransaction {
  id: string;
  chainId: SupportedChain;
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string | null;
  value: string; // BigNumber string (wei / lamports / base unit)
  valueFormatted: number; // Human-readable decimal
  fee: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  finality: FinalityStatus;
  timestamp: number;
  classification: TransactionClassification;
  metadata: Record<string, any>; // Chain-specific details (e.g. Solana compute units, EVM gas details)
}

export interface NormalizedEvent {
  id: string;
  chainId: SupportedChain;
  transactionHash: string;
  blockNumber: number;
  eventType: string;
  contractAddress: string;
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
  metadata?: Record<string, any>;
}

export interface TokenMetadata {
  address: string;
  chainId: SupportedChain;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: string;
  logoUri?: string;
  metadataStatus: 'PENDING' | 'VERIFIED' | 'FAILED';
  lastAttempt?: number;
  error?: string;
}

export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  amount: string; // Raw integer string
  uiAmount: number; // Human-readable decimal
  decimals: number;
}

export interface NativeBalance {
  chainId: SupportedChain;
  walletAddress: string;
  balanceRaw: string;
  balanceFormatted: number;
  symbol: string;
}

export interface RPCRequestTrace {
  requestId: string;
  chainId: SupportedChain;
  provider: string;
  method: string;
  startedAt: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILURE' | 'RATE_LIMITED' | 'TIMEOUT';
  error?: string;
}

export interface RPCProviderConfig {
  id: string;
  name: string;
  chainId: SupportedChain;
  url: string;
  wsUrl?: string;
  tier: 'primary' | 'secondary' | 'fallback';
  weight: number;
  maxRps: number;
  timeoutMs: number;
}

export interface RPCProviderMetrics {
  providerId: string;
  chainId: SupportedChain;
  latencyMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  consecutiveFailures: number;
  lastSuccessfulRequest?: number;
  lastFailure?: number;
  status: ProviderHealthStatus;
}
