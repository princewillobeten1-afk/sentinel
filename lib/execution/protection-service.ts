/**
 * MEV Protection & Security Routing Service (Sprint 47 §62-65).
 */

import {
  MEVProtectionStrategy,
  SwapExecutionRequest,
  SwapRouteOption,
} from './types';

export interface ProtectionDetermination {
  strategy: MEVProtectionStrategy;
  isPrivateRelay: boolean;
  priorityFeeMicroLamportsOrGwei: number;
  reason: string;
}

export class ExecutionProtectionService {
  private static instance: ExecutionProtectionService;

  private constructor() {}

  public static getInstance(): ExecutionProtectionService {
    if (!ExecutionProtectionService.instance) {
      ExecutionProtectionService.instance = new ExecutionProtectionService();
    }
    return ExecutionProtectionService.instance;
  }

  /**
   * Evaluates MEV risk and selects optimal protection strategy
   */
  public determineProtection(
    request: SwapExecutionRequest,
    route: SwapRouteOption
  ): ProtectionDetermination {
    const tradeValueUsd = parseFloat(request.amountIn) * 150; // normalized proxy
    const priceImpact = route.priceImpactPct;

    // Explicit user preference takes priority
    if (request.mevStrategy === MEVProtectionStrategy.PRIVATE_RPC) {
      return {
        strategy: MEVProtectionStrategy.PRIVATE_RPC,
        isPrivateRelay: true,
        priorityFeeMicroLamportsOrGwei: 50000,
        reason: 'User requested explicit private RPC relay submission.',
      };
    }

    // High value (>$5,000) or high price impact (>2.0%) automatically gets Private Relay protection
    if (tradeValueUsd >= 5000 || priceImpact >= 2.0) {
      return {
        strategy: MEVProtectionStrategy.PRIVATE_RPC,
        isPrivateRelay: true,
        priorityFeeMicroLamportsOrGwei: 100000,
        reason: `High risk order ($${tradeValueUsd.toFixed(0)} value, ${priceImpact.toFixed(2)}% impact) auto-routed to Private MEV Relay.`,
      };
    }

    if (tradeValueUsd >= 1000 || priceImpact >= 0.8) {
      return {
        strategy: MEVProtectionStrategy.PROTECTED_ROUTE,
        isPrivateRelay: false,
        priorityFeeMicroLamportsOrGwei: 25000,
        reason: 'Moderate order value routed with priority compute budget.',
      };
    }

    return {
      strategy: MEVProtectionStrategy.PUBLIC_MEMPOOL,
      isPrivateRelay: false,
      priorityFeeMicroLamportsOrGwei: 5000,
      reason: 'Standard public mempool broadcast for low-impact order.',
    };
  }
}

export const executionProtectionService = ExecutionProtectionService.getInstance();
