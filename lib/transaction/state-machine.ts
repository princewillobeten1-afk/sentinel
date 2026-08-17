/**
 * Deterministic Transaction Lifecycle State Machine (Sprint 32 §8-9).
 *
 * Enforces the strict financial transaction lifecycle:
 *   CREATED -> SIMULATING -> AUTHORIZED -> SIGNED -> SUBMITTED -> PENDING -> CONFIRMED
 *
 * Terminal failure and correction states:
 *   - SIMULATION_FAILED
 *   - USER_REJECTED
 *   - SIGNATURE_FAILED
 *   - BROADCAST_FAILED
 *   - CONFIRMATION_FAILED
 *   - REVERTED
 *   - EXPIRED
 *   - DROPPED
 *   - RECONCILED_CORRECTION
 *
 * Invalid state jumps (e.g. CREATED -> CONFIRMED directly) are strictly rejected to prevent race conditions.
 */

import { ApiError } from '../server/errors';

export type TransactionLifecycleState =
  | 'CREATED'
  | 'SIMULATING'
  | 'AUTHORIZED'
  | 'SIGNED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'CONFIRMED'
  // Terminal failure / correction states
  | 'SIMULATION_FAILED'
  | 'USER_REJECTED'
  | 'SIGNATURE_FAILED'
  | 'BROADCAST_FAILED'
  | 'CONFIRMATION_FAILED'
  | 'REVERTED'
  | 'EXPIRED'
  | 'DROPPED'
  | 'RECONCILED_CORRECTION';

export const VALID_TRANSITIONS: Record<TransactionLifecycleState, TransactionLifecycleState[]> = {
  CREATED: ['SIMULATING', 'USER_REJECTED', 'EXPIRED'],
  SIMULATING: ['AUTHORIZED', 'SIMULATION_FAILED', 'EXPIRED'],
  AUTHORIZED: ['SIGNED', 'USER_REJECTED', 'EXPIRED'],
  SIGNED: ['SUBMITTED', 'SIGNATURE_FAILED', 'EXPIRED'],
  SUBMITTED: ['PENDING', 'BROADCAST_FAILED', 'DROPPED', 'EXPIRED'],
  PENDING: ['CONFIRMED', 'CONFIRMATION_FAILED', 'REVERTED', 'DROPPED', 'EXPIRED'],
  CONFIRMED: ['RECONCILED_CORRECTION'], // Only reconciliation can correct a confirmed state
  // Terminal states allow reconciliation correction if discrepancy is proven on-chain
  SIMULATION_FAILED: [],
  USER_REJECTED: [],
  SIGNATURE_FAILED: [],
  BROADCAST_FAILED: [],
  CONFIRMATION_FAILED: ['RECONCILED_CORRECTION'],
  REVERTED: ['RECONCILED_CORRECTION'],
  EXPIRED: [],
  DROPPED: ['RECONCILED_CORRECTION'],
  RECONCILED_CORRECTION: [],
};

export interface StateTransitionLog {
  from: TransactionLifecycleState;
  to: TransactionLifecycleState;
  timestamp: number;
  reason?: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ManagedTransaction {
  id: string;
  userId: string;
  walletAddress: string;
  symbol: string;
  side: 'buy' | 'sell';
  amountIn: string;
  minAmountOut: string;
  state: TransactionLifecycleState;
  txHash?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
  history: StateTransitionLog[];
}

export class TransactionStateMachine {
  public static isValidTransition(from: TransactionLifecycleState, to: TransactionLifecycleState): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  public static transition(
    tx: ManagedTransaction,
    to: TransactionLifecycleState,
    options?: {
      reason?: string;
      txHash?: string;
      metadata?: Record<string, unknown>;
      now?: number;
    }
  ): ManagedTransaction {
    const from = tx.state;
    const now = options?.now ?? Date.now();

    if (!this.isValidTransition(from, to)) {
      throw new ApiError(
        `Invalid transaction state transition from '${from}' to '${to}'.`,
        400,
        'INVALID_STATE_TRANSITION',
        { transactionId: tx.id, currentState: from, targetState: to }
      );
    }

    tx.state = to;
    tx.updatedAt = now;
    if (options?.txHash) {
      tx.txHash = options.txHash;
    }
    if (options?.reason) {
      tx.error = options.reason;
    }
    if (to === 'CONFIRMED' || to === 'REVERTED' || to === 'SIMULATION_FAILED' || to === 'USER_REJECTED') {
      tx.completedAt = now;
    }

    tx.history.push({
      from,
      to,
      timestamp: now,
      reason: options?.reason,
      txHash: options?.txHash,
      metadata: options?.metadata,
    });

    return tx;
  }

  public static createTransaction(params: {
    id: string;
    userId: string;
    walletAddress: string;
    symbol: string;
    side: 'buy' | 'sell';
    amountIn: string;
    minAmountOut: string;
    now?: number;
  }): ManagedTransaction {
    const now = params.now ?? Date.now();
    return {
      id: params.id,
      userId: params.userId,
      walletAddress: params.walletAddress,
      symbol: params.symbol,
      side: params.side,
      amountIn: params.amountIn,
      minAmountOut: params.minAmountOut,
      state: 'CREATED',
      createdAt: now,
      updatedAt: now,
      history: [
        {
          from: 'CREATED',
          to: 'CREATED',
          timestamp: now,
          reason: 'Transaction initialized',
        },
      ],
    };
  }
}
