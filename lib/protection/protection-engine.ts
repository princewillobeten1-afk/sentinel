import { PositionProtection, StopLossConfig, TakeProfitTarget, NetPnlEstimate } from './types';

export class ProtectionEngine {
  /**
   * Evaluates trailing stops when market price changes.
   * Trailing stops only move UP (for long positions) and never move down.
   */
  public evaluateTrailingStop(stop: StopLossConfig, marketPrice: number): StopLossConfig {
    if (stop.type !== 'TRAILING' || !stop.trailPct) return stop;

    const highest = Math.max(stop.highestObservedPrice || marketPrice, marketPrice);
    const newStopPrice = highest * (1 - stop.trailPct / 100);

    // Stop price only ratchets upward
    const updatedStopPrice = Math.max(stop.stopPrice || 0, newStopPrice);

    return {
      ...stop,
      highestObservedPrice: highest,
      stopPrice: parseFloat(updatedStopPrice.toFixed(4))
    };
  }

  /**
   * Calculates True Net P&L estimate considering gross P&L, gas, fees, and slippage.
   */
  public calculateNetPnlEstimate(params: {
    entryPrice: number;
    targetPrice: number;
    positionUsd: number;
    estimatedSlippagePct?: number;
  }): NetPnlEstimate {
    const grossPnlPct = ((params.targetPrice - params.entryPrice) / params.entryPrice) * 100;
    const estimatedFeePct = 0.3; // DEX fee ~0.3%
    const estimatedGasPct = 0.1; // Network priority fee ~0.1%
    const estimatedSlippagePct = params.estimatedSlippagePct ?? 0.5;

    const totalCostsPct = estimatedFeePct + estimatedGasPct + estimatedSlippagePct;
    const netPnlPct = grossPnlPct - totalCostsPct;
    const netPnlUsd = (params.positionUsd * netPnlPct) / 100;

    return {
      grossPnlPct: parseFloat(grossPnlPct.toFixed(2)),
      estimatedFeePct,
      estimatedGasPct,
      estimatedSlippagePct,
      netPnlPct: parseFloat(netPnlPct.toFixed(2)),
      netPnlUsd: parseFloat(netPnlUsd.toFixed(2))
    };
  }

  /**
   * Adjusts stop loss to break-even after TP1 execution (OCO logic).
   */
  public applyAutoBreakEven(protection: PositionProtection): PositionProtection {
    if (!protection.autoBreakEven) return protection;

    // Break-even price includes ~0.5% fee coverage
    const breakEvenPrice = protection.entryPrice * 1.005;

    const updatedStopLoss: StopLossConfig = protection.stopLoss ? {
      ...protection.stopLoss,
      type: 'BREAK_EVEN',
      stopPrice: parseFloat(breakEvenPrice.toFixed(4)),
      isTriggered: false
    } : {
      type: 'BREAK_EVEN',
      stopPrice: parseFloat(breakEvenPrice.toFixed(4)),
      portionPct: 100,
      isTriggered: false
    };

    return {
      ...protection,
      stopLoss: updatedStopLoss,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Checks if current market price triggers Stop Loss or any Take Profit level.
   */
  public checkTriggers(protection: PositionProtection, marketPrice: number): {
    stopTriggered: boolean;
    triggeredTpTarget?: TakeProfitTarget;
  } {
    let stopTriggered = false;
    let triggeredTpTarget: TakeProfitTarget | undefined;

    // 1. Check Stop Loss trigger (Price <= StopPrice)
    if (protection.stopLoss && marketPrice <= protection.stopLoss.stopPrice && !protection.stopLoss.isTriggered) {
      stopTriggered = true;
    }

    // 2. Check Take Profit triggers (Price >= TargetPrice)
    const pendingTps = protection.takeProfits
      .filter(tp => tp.status === 'PENDING')
      .sort((a, b) => a.targetPrice - b.targetPrice);

    for (const tp of pendingTps) {
      if (marketPrice >= tp.targetPrice) {
        triggeredTpTarget = tp;
        break;
      }
    }

    return { stopTriggered, triggeredTpTarget };
  }
}

export const protectionEngine = new ProtectionEngine();
