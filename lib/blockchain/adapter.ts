/**
 * Unified Blockchain Adapter Interface (Sprint 44 §3-4).
 *
 * Defines the core adapter interface that all chains (Solana, EVM/Ethereum, Base) must implement.
 */

import {
  SupportedChain,
  BlockModel,
  NormalizedTransaction,
  NormalizedEvent,
  TokenMetadata,
  TokenBalance,
  NativeBalance,
  FinalityStatus,
} from './types';

export interface LogFilter {
  fromBlock?: number;
  toBlock?: number;
  address?: string;
  topics?: string[];
  programId?: string; // Solana-specific
}

export interface BlockchainAdapter {
  readonly chainId: SupportedChain;
  readonly name: string;

  /**
   * Fetches the latest canonical block or slot.
   */
  getLatestBlock(finality?: FinalityStatus): Promise<BlockModel>;

  /**
   * Fetches a block by its number (or slot for Solana) or hash.
   */
  getBlock(numberOrHash: number | string): Promise<BlockModel | null>;

  /**
   * Fetches a single transaction and converts it to NormalizedTransaction.
   */
  getTransaction(hash: string): Promise<NormalizedTransaction | null>;

  /**
   * Fetches multiple transactions in batch.
   */
  getTransactions(hashes: string[]): Promise<NormalizedTransaction[]>;

  /**
   * Fetches logs / events matching a filter.
   */
  getLogs(filter: LogFilter): Promise<NormalizedEvent[]>;

  /**
   * Retrieves on-chain token metadata (name, symbol, decimals).
   */
  getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null>;

  /**
   * Retrieves specific token balance for a wallet.
   */
  getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance>;

  /**
   * Retrieves native gas/chain balance (SOL / ETH) for a wallet.
   */
  getNativeBalance(walletAddress: string): Promise<NativeBalance>;

  /**
   * Subscribes to real-time blockchain logs/blocks. Returns an unsubscribe teardown function.
   */
  subscribe(filter: LogFilter, callback: (event: NormalizedEvent) => void): () => void;

  /**
   * Estimates network fee for a transaction payload.
   */
  estimateFees(transactionPayload: any): Promise<number>;
}
