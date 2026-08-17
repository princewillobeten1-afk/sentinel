export interface PositionState {
  tokenId: string;
  sizeUsd: number;
  tokenAmount: number;
}

export interface DivergenceReport {
  isDivergent: boolean;
  expectedTokenAmount: number;
  actualTokenAmount: number;
  divergencePercentage: number;
  cause?: string;
}

export class CopyReconciliationEngine {
  /**
   * Compares the source trader's position against the user's copied position.
   * Detects if the copy has drifted from the expected proportional allocation.
   */
  public checkDivergence(
    sourcePosition: PositionState,
    copiedPosition: PositionState,
    copyProportionRatio: number
  ): DivergenceReport {
    if (sourcePosition.tokenId !== copiedPosition.tokenId) {
      throw new Error('Token ID mismatch in reconciliation');
    }

    const expectedTokenAmount = sourcePosition.tokenAmount * copyProportionRatio;
    const actualTokenAmount = copiedPosition.tokenAmount;
    
    let divergencePercentage = 0;
    if (expectedTokenAmount > 0) {
      divergencePercentage = Math.abs(expectedTokenAmount - actualTokenAmount) / expectedTokenAmount;
    } else if (actualTokenAmount > 0) {
      divergencePercentage = 1; // 100% divergence if expected 0 but have some
    }

    const isDivergent = divergencePercentage > 0.05; // 5% tolerance for slippage differences

    let cause = undefined;
    if (isDivergent) {
      if (actualTokenAmount < expectedTokenAmount) {
        cause = 'Likely missed partial exit or severe entry slippage';
      } else {
        cause = 'Likely missed source partial exit or manual user buy';
      }
    }

    return {
      isDivergent,
      expectedTokenAmount,
      actualTokenAmount,
      divergencePercentage,
      cause
    };
  }

  /**
   * Calculates what portion of the user's copied position should be sold
   * when the source trader executes a partial sell.
   */
  public calculateExitSize(
    sourcePreviousTokens: number,
    sourceTokensSold: number,
    copiedTokens: number
  ): number {
    if (sourcePreviousTokens <= 0) return 0;
    const percentageSold = sourceTokensSold / sourcePreviousTokens;
    return copiedTokens * percentageSold;
  }
}
