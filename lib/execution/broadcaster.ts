/**
 * Transaction Broadcaster & Multi-Tier RPC Failover (Sprint 47 §40-42, §75-76, §97).
 */

import { dbRepository } from '../db/repository';

export interface BroadcastResult {
  success: boolean;
  transactionHash?: string;
  providerUsed: string;
  attemptNumber: number;
  error?: string;
}

export class Broadcaster {
  private static instance: Broadcaster;
  private primaryRpcHealthy = true;
  private secondaryRpcHealthy = true;

  private constructor() {}

  public static getInstance(): Broadcaster {
    if (!Broadcaster.instance) {
      Broadcaster.instance = new Broadcaster();
    }
    return Broadcaster.instance;
  }

  /**
   * Broadcasts signed transaction payload with failover and attempt logging
   */
  public async broadcast(
    executionId: string,
    signedPayload: string
  ): Promise<BroadcastResult> {
    if (process.env.NODE_ENV !== 'test') {
      return { success: false, providerUsed: 'UNSUPPORTED_LEGACY_INTENT', attemptNumber: 0,
        error: 'Legacy simulated intents cannot be broadcast. Use the authenticated Solana prepare/sign/submit flow.' };
    }
    const existingAttempts = dbRepository.getAttempts(executionId);
    const attemptNumber = existingAttempts.length + 1;

    // Check if previously broadcasted successfully
    const confirmedAttempt = existingAttempts.find((a) => a.status === 'SUCCESS' && a.transaction_hash);
    if (confirmedAttempt) {
      return {
        success: true,
        transactionHash: confirmedAttempt.transaction_hash!,
        providerUsed: confirmedAttempt.provider,
        attemptNumber: confirmedAttempt.attempt_number,
      };
    }

    const txHash = `0xTx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Tier 1: Primary RPC
    if (this.primaryRpcHealthy) {
      dbRepository.saveAttempt({
        attempt_id: `att_${Date.now()}_1`,
        execution_id: executionId,
        provider: 'PRIMARY_RPC_HELIUS_ALCHEMY',
        transaction_hash: txHash,
        attempt_number: attemptNumber,
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        transactionHash: txHash,
        providerUsed: 'PRIMARY_RPC_HELIUS_ALCHEMY',
        attemptNumber,
      };
    }

    // Tier 2: Secondary RPC Failover
    if (this.secondaryRpcHealthy) {
      dbRepository.saveAttempt({
        attempt_id: `att_${Date.now()}_2`,
        execution_id: executionId,
        provider: 'SECONDARY_RPC_QUICKNODE',
        transaction_hash: txHash,
        attempt_number: attemptNumber,
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        transactionHash: txHash,
        providerUsed: 'SECONDARY_RPC_QUICKNODE',
        attemptNumber,
      };
    }

    // Tier 3: Public Fallback RPC
    dbRepository.saveAttempt({
      attempt_id: `att_${Date.now()}_3`,
      execution_id: executionId,
      provider: 'TERTIARY_PUBLIC_FALLBACK',
      transaction_hash: txHash,
      attempt_number: attemptNumber,
      status: 'SUCCESS',
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      transactionHash: txHash,
      providerUsed: 'TERTIARY_PUBLIC_FALLBACK',
      attemptNumber,
    };
  }

  public setPrimaryRpcHealth(isHealthy: boolean): void {
    this.primaryRpcHealthy = isHealthy;
  }

  public setSecondaryRpcHealth(isHealthy: boolean): void {
    this.secondaryRpcHealthy = isHealthy;
  }

  public reset(): void {
    this.primaryRpcHealthy = true;
    this.secondaryRpcHealthy = true;
  }
}

export const broadcaster = Broadcaster.getInstance();
