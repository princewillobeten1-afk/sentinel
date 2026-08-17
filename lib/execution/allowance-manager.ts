/**
 * ERC-20 Allowance & Approval Manager (Sprint 47 §31-34).
 */

import { dbRepository } from '../db/repository';

export interface ApprovalCheckResult {
  isApproved: boolean;
  currentAllowance: string;
  requiredAmount: string;
  approvalPayload?: {
    tokenAddress: string;
    spenderAddress: string;
    amountToApprove: string;
    callData: string;
  };
}

export class AllowanceManager {
  private static instance: AllowanceManager;

  private constructor() {}

  public static getInstance(): AllowanceManager {
    if (!AllowanceManager.instance) {
      AllowanceManager.instance = new AllowanceManager();
    }
    return AllowanceManager.instance;
  }

  /**
   * Checks if token spender has sufficient allowance for swap
   */
  public async checkAllowance(
    walletAddress: string,
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: string
  ): Promise<ApprovalCheckResult> {
    // Native tokens (SOL, ETH) do not require approvals
    if (
      tokenAddress.toLowerCase() === 'sol' ||
      tokenAddress.toLowerCase() === 'eth' ||
      tokenAddress === 'So11111111111111111111111111111111111111112'
    ) {
      return {
        isApproved: true,
        currentAllowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        requiredAmount,
      };
    }

    const saved = dbRepository.getApproval(walletAddress, tokenAddress);
    const allowanceNum = saved ? parseFloat(saved.amount_approved) : 0;
    const requiredNum = parseFloat(requiredAmount);

    if (allowanceNum >= requiredNum) {
      return {
        isApproved: true,
        currentAllowance: allowanceNum.toString(),
        requiredAmount,
      };
    }

    // Exact Bounded Approval (Sprint 47 §32: Never request unlimited approval by default)
    return {
      isApproved: false,
      currentAllowance: allowanceNum.toString(),
      requiredAmount,
      approvalPayload: {
        tokenAddress,
        spenderAddress,
        amountToApprove: requiredAmount,
        callData: `0x095ea7b3${spenderAddress.slice(2).padStart(64, '0')}${Math.round(requiredNum * 1e18).toString(16).padStart(64, '0')}`,
      },
    };
  }

  /**
   * Records confirmed token approval
   */
  public recordApproval(
    userId: string,
    walletAddress: string,
    tokenAddress: string,
    spenderAddress: string,
    amountApproved: string
  ): void {
    dbRepository.saveApproval({
      approval_id: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      wallet_address: walletAddress,
      token_address: tokenAddress,
      spender_address: spenderAddress,
      amount_approved: amountApproved,
      status: 'APPROVED',
      created_at: new Date().toISOString(),
    });
  }
}

export const allowanceManager = AllowanceManager.getInstance();
