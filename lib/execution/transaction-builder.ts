/**
 * Transaction Builder & Idempotency Manager (Sprint 47 §14-18, §87).
 */

import { routeEngine } from './route-engine';
import { dbRepository } from '../db/repository';
import {
  SwapExecutionRequest,
  SwapRouteOption,
  UnsignedTransactionPayload,
} from './types';

export interface BuiltTransactionIntent {
  intentId: string;
  executionId: string;
  idempotencyKey: string;
  route: SwapRouteOption;
  payload: UnsignedTransactionPayload;
  isDuplicate: boolean;
  createdAt: string;
}

export class TransactionBuilder {
  private static instance: TransactionBuilder;
  private nonces: Map<string, number> = new Map(); // key: chainId:walletAddress

  private constructor() {}

  public static getInstance(): TransactionBuilder {
    if (!TransactionBuilder.instance) {
      TransactionBuilder.instance = new TransactionBuilder();
    }
    return TransactionBuilder.instance;
  }

  /**
   * Constructs an unsigned transaction payload from a validated route and idempotency key
   */
  public async buildTransaction(
    executionId: string,
    request: SwapExecutionRequest,
    route: SwapRouteOption
  ): Promise<BuiltTransactionIntent> {
    // 1. Idempotency Check
    const existingIntent = dbRepository.getIntentByIdempotencyKey(request.idempotencyKey);
    if (existingIntent) {
      const parsedPayload: UnsignedTransactionPayload = JSON.parse(existingIntent.payload_json);
      return {
        intentId: existingIntent.intent_id,
        executionId: existingIntent.execution_id,
        idempotencyKey: existingIntent.idempotency_key,
        route,
        payload: parsedPayload,
        isDuplicate: true,
        createdAt: existingIntent.created_at,
      };
    }

    // 2. Resolve Nonce for EVM
    const nonceKey = `${request.chainId.toLowerCase()}:${request.walletAddress.toLowerCase()}`;
    const currentNonce = this.nonces.get(nonceKey) || 0;

    // 3. Delegate to DEX Execution Adapter
    const adapter = routeEngine.getAdapterForChain(request.chainId);
    const payload = await adapter.buildSwapTransaction(
      route,
      request.walletAddress,
      request.slippage,
      currentNonce
    );

    // 4. Increment Nonce
    this.nonces.set(nonceKey, currentNonce + 1);

    const intentId = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // 5. Persist Intent to Database Repository
    dbRepository.saveIntent({
      intent_id: intentId,
      execution_id: executionId,
      user_id: request.userId,
      wallet_address: request.walletAddress,
      chain_id: request.chainId,
      idempotency_key: request.idempotencyKey,
      payload_json: JSON.stringify(payload),
      status: 'PREPARED',
      created_at: now,
    });

    return {
      intentId,
      executionId,
      idempotencyKey: request.idempotencyKey,
      route,
      payload,
      isDuplicate: false,
      createdAt: now,
    };
  }

  public reset(): void {
    this.nonces.clear();
  }
}

export const transactionBuilder = TransactionBuilder.getInstance();
