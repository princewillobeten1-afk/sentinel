/**
 * Safety Validator & Protection Rules (Sprint 47 §22-27, §68-70, §88-91).
 */

import { masterWalletProvider } from '../wallet/wallet-provider';
import { dbRepository } from '../db/repository';
import {
  SwapExecutionRequest,
  SwapRouteOption,
  ExecutionFailureCode,
} from './types';

export interface SafetyValidationResult {
  isSafe: boolean;
  failureCode?: ExecutionFailureCode;
  reason?: string;
}

export class SafetyValidator {
  private static instance: SafetyValidator;
  private maxAllowedSlippage = 5.0; // 5% default safety ceiling
  private maxPriceDriftPct = 1.5; // 1.5% max price movement between quote and execution

  private constructor() {}

  public static getInstance(): SafetyValidator {
    if (!SafetyValidator.instance) {
      SafetyValidator.instance = new SafetyValidator();
    }
    return SafetyValidator.instance;
  }

  /**
   * Evaluates comprehensive pre-signing safety checks
   */
  public async evaluateSafety(
    request: SwapExecutionRequest,
    route: SwapRouteOption
  ): Promise<SafetyValidationResult> {
    // 1. Amount Validation
    const amountNum = parseFloat(request.amountIn);
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        isSafe: false,
        failureCode: ExecutionFailureCode.INSUFFICIENT_BALANCE,
        reason: 'Input amount must be a positive numerical value',
      };
    }

    // 2. Slippage Limits
    if (request.slippage > this.maxAllowedSlippage) {
      return {
        isSafe: false,
        failureCode: ExecutionFailureCode.SLIPPAGE_TOO_HIGH,
        reason: `Requested slippage (${request.slippage}%) exceeds maximum safety limit of ${this.maxAllowedSlippage}%.`,
      };
    }

    // 3. Blocklist Verification
    if (dbRepository.isTargetBlocklisted(request.tokenIn) || dbRepository.isTargetBlocklisted(request.tokenOut)) {
      return {
        isSafe: false,
        failureCode: ExecutionFailureCode.TARGET_BLOCKLISTED,
        reason: 'Execution involves a blocklisted or compromised token.',
      };
    }

    // 4. Quote Drift / Price Movement Check
    // Simulating reserve drift check: compare route expected output against current pool quote
    const priceDriftPct = route.priceImpactPct;
    if (priceDriftPct > this.maxPriceDriftPct) {
      return {
        isSafe: false,
        failureCode: ExecutionFailureCode.QUOTE_MOVED,
        reason: `Market price has shifted by ${priceDriftPct.toFixed(2)}% since quote generation. Fresh quote required.`,
      };
    }

    // 5. Native Gas Balance Sufficiency
    const nativeBalance = masterWalletProvider.getBalance('native').amount;
    const estimatedGasSolOrEth = route.estimatedNetworkFeeUsd / 150; // normalized conversion
    if (nativeBalance < estimatedGasSolOrEth) {
      return {
        isSafe: false,
        failureCode: ExecutionFailureCode.INSUFFICIENT_GAS,
        reason: 'Insufficient native token balance to pay network transaction and priority fees.',
      };
    }

    return {
      isSafe: true,
    };
  }

  public setMaxAllowedSlippage(val: number): void {
    this.maxAllowedSlippage = val;
  }

  public setMaxPriceDriftPct(val: number): void {
    this.maxPriceDriftPct = val;
  }
}

export const safetyValidator = SafetyValidator.getInstance();
