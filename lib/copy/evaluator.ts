import { TokenIntelligence, CopyProfile, LeaderSignal, CopyDecision, CopyTradeResult } from './types';

export class CopyEvaluationEngine {
  /**
   * Evaluates a leader's trade signal against a follower's copy profile and token intelligence.
   * This is the core logic that prevents blind copying and enforces risk limits.
   */
  public evaluateSignal(
    signal: LeaderSignal,
    profile: CopyProfile,
    intelligence: TokenIntelligence,
    followerWalletBalance: number
  ): CopyTradeResult {
    const reasons: string[] = [];

    // 1. Freshness Check
    const latency = Date.now() - signal.timestamp;
    if (latency > 30000) { // 30 seconds max latency for copy trades
      return this.skip(signal, 'Trade is too stale. Execution latency exceeded 30 seconds.');
    }

    // 2. Buy/Sell Permissions
    if (signal.side === 'BUY' && !profile.copyBuys) {
      return this.skip(signal, 'Profile is configured to ignore buys.');
    }
    if (signal.side === 'SELL' && !profile.copySells) {
      return this.skip(signal, 'Profile is configured to ignore sells.');
    }

    // 3. Token Intelligence (Risk & Exitability)
    if (intelligence.riskScore > profile.maxTokenRiskScore) {
      return this.skip(signal, `Token risk score (${intelligence.riskScore}) exceeds your maximum allowed (${profile.maxTokenRiskScore}).`);
    }
    if (intelligence.exitabilityScore < profile.minExitabilityScore) {
      return this.skip(signal, `Exitability score (${intelligence.exitabilityScore}) is below your minimum required (${profile.minExitabilityScore}).`);
    }

    // 4. Base Size Calculation
    let proposedAmount = Math.min(signal.valueUsd, profile.maxTradeUsd);

    // 5. Liquidity Check
    // A follower shouldn't represent more than 5% of the executable liquidity to avoid massive slippage.
    const maxSafeLiquidity = intelligence.executableLiquidity * 0.05;
    if (proposedAmount > maxSafeLiquidity) {
      reasons.push(`Proposed size reduced due to low liquidity. Requested $${proposedAmount.toFixed(2)}, max safe is $${maxSafeLiquidity.toFixed(2)}.`);
      proposedAmount = maxSafeLiquidity;
    }

    // 6. Balance Check
    if (proposedAmount > followerWalletBalance) {
      reasons.push(`Insufficient balance. Reduced from $${proposedAmount.toFixed(2)} to $${followerWalletBalance.toFixed(2)}.`);
      proposedAmount = followerWalletBalance;
    }

    // 7. Final Decision
    if (proposedAmount <= 0) {
      return this.skip(signal, 'Calculated execution size was $0 after applying risk constraints.');
    }

    if (proposedAmount < Math.min(signal.valueUsd, profile.maxTradeUsd)) {
      return {
        decision: 'COPY_WITH_REDUCTION',
        approvedAmountUsd: proposedAmount,
        reason: reasons.join(' '),
        signal
      };
    }

    return {
      decision: 'COPY',
      approvedAmountUsd: proposedAmount,
      reason: 'Trade passed all safety, liquidity, and risk checks.',
      signal
    };
  }

  private skip(signal: LeaderSignal, reason: string): CopyTradeResult {
    return {
      decision: 'SKIP',
      approvedAmountUsd: 0,
      reason,
      signal
    };
  }
}
