import { CopiedPosition } from './types';

export class PositionTracker {
  /**
   * Calculates the follower's sell size based on the leader's sell signal.
   * If the leader sells 50% of their position, the follower sells 50% of their copied position.
   * 
   * @param leaderSellPercentage The percentage of the leader's position being sold (0.0 to 1.0)
   * @param copiedPosition The follower's internal ledger tracking this specific copied position
   * @returns The exact quantity the follower should sell
   */
  public calculateFollowerSellSize(leaderSellPercentage: number, copiedPosition: CopiedPosition): number {
    if (leaderSellPercentage <= 0) return 0;
    if (leaderSellPercentage >= 1) return copiedPosition.currentQuantity;
    
    // Scale sell proportionally
    return copiedPosition.currentQuantity * leaderSellPercentage;
  }

  /**
   * Reconciles a manual exit by the user against the tracked copied position.
   * If a user manually sells part of a copied bag, we must reduce the ledger so a future leader sell
   * doesn't cause us to sell tokens the user already liquidated or wants to hold long-term.
   */
  public reconcileManualExit(copiedPosition: CopiedPosition, manualSellQuantity: number): CopiedPosition {
    const remainingQuantity = Math.max(0, copiedPosition.currentQuantity - manualSellQuantity);
    
    // Adjust original allocation proportionately so ROI calculations remain accurate
    const reductionRatio = remainingQuantity / copiedPosition.currentQuantity;
    const newOriginalAllocation = copiedPosition.originalAllocationUsd * reductionRatio;
    const newCostBasis = copiedPosition.costBasisUsd * reductionRatio;

    return {
      ...copiedPosition,
      currentQuantity: remainingQuantity,
      originalAllocationUsd: newOriginalAllocation,
      costBasisUsd: newCostBasis
    };
  }
}
