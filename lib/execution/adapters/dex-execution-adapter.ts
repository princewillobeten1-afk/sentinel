/**
 * DEX Execution Adapter Interface (Sprint 47 §12-13, §77-79).
 */

import {
  SwapExecutionRequest,
  SwapRouteOption,
  UnsignedTransactionPayload,
  SimulationResult,
} from '../types';

export interface DecodedSwapResult {
  actualAmountOut: string;
  senderAddress: string;
  recipientAddress: string;
  feesPaid: {
    gasUsed: number;
    effectiveGasPriceGwei?: number;
    totalFeeUsd: number;
  };
  revertReason?: string;
}

export interface DexExecutionAdapter {
  getProtocolIdentifier(): string;
  getChainId(): string;

  /**
   * Discovers available swap route options for a token pair
   */
  getRoutes(request: SwapExecutionRequest): Promise<SwapRouteOption[]>;

  /**
   * Constructs network-specific unsigned transaction payload
   */
  buildSwapTransaction(
    route: SwapRouteOption,
    walletAddress: string,
    slippage: number,
    nonce?: number
  ): Promise<UnsignedTransactionPayload>;

  /**
   * Executes pre-flight dry-run simulation
   */
  simulateSwap(
    payload: UnsignedTransactionPayload,
    minimumOutput: string,
    expectedOutput?: string
  ): Promise<SimulationResult>;

  /**
   * Decodes on-chain transaction receipt into standardized swap result
   */
  decodeSwapResult(receipt: any): Promise<DecodedSwapResult>;

  /**
   * Health and latency check
   */
  getHealth(): Promise<{ isHealthy: boolean; latencyMs: number }>;
}
