import { 
  PositionProtection, 
  StopLossConfig, 
  TakeProfitTarget, 
  ProtectionMode, 
  ProtectionExecutionRecord 
} from './types';
import { protectionEngine } from './protection-engine';
import { protectionReservationManager } from './protection-reservation';
import { orderManager } from '../order/manager';

const protectionStore = new Map<string, PositionProtection>(); // positionId -> protection
const executionHistoryStore = new Map<string, ProtectionExecutionRecord[]>(); // positionId -> executions

export class ProtectionService {
  public setProtection(params: {
    positionId: string;
    walletId: string;
    tokenId: string;
    tokenSymbol: string;
    entryPrice: number;
    currentPrice: number;
    positionTokens: number;
    protectionMode?: ProtectionMode;
    autoBreakEven?: boolean;
    stopLoss?: StopLossConfig;
    takeProfits?: TakeProfitTarget[];
  }): PositionProtection {
    const now = new Date().toISOString();
    const existing = protectionStore.get(params.positionId);
    const version = existing ? existing.version + 1 : 1;

    const protection: PositionProtection = {
      id: existing?.id || `prot_${Math.random().toString(36).substring(2, 10)}`,
      positionId: params.positionId,
      walletId: params.walletId,
      tokenId: params.tokenId,
      tokenSymbol: params.tokenSymbol,
      entryPrice: params.entryPrice,
      currentPrice: params.currentPrice,
      positionTokens: params.positionTokens,
      protectionMode: params.protectionMode || 'BALANCED',
      health: 'HEALTHY',
      autoBreakEven: params.autoBreakEven ?? true,
      stopLoss: params.stopLoss,
      takeProfits: params.takeProfits || [],
      isActive: true,
      version,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    // If stop loss is trailing, initialize highestObservedPrice
    if (protection.stopLoss && protection.stopLoss.type === 'TRAILING') {
      protection.stopLoss.highestObservedPrice = Math.max(params.entryPrice, params.currentPrice);
      if (!protection.stopLoss.stopPrice && protection.stopLoss.trailPct) {
        protection.stopLoss.stopPrice = protection.stopLoss.highestObservedPrice * (1 - protection.stopLoss.trailPct / 100);
      }
    }

    protectionStore.set(params.positionId, protection);
    return protection;
  }

  public getProtection(positionId: string): PositionProtection | undefined {
    return protectionStore.get(positionId);
  }

  public removeProtection(positionId: string): boolean {
    const protection = protectionStore.get(positionId);
    if (!protection) return false;

    protection.isActive = false;
    protection.health = 'INVALID';
    protection.updatedAt = new Date().toISOString();

    return true;
  }

  public evaluateMarketTick(positionId: string, marketPrice: number): {
    evaluated: boolean;
    executedType?: string;
    executionRecord?: ProtectionExecutionRecord;
    protection?: PositionProtection;
  } {
    if (process.env.NODE_ENV !== 'test') throw new Error('Automated protection requires a wallet-signed on-chain transaction.');
    const protection = protectionStore.get(positionId);
    if (!protection || !protection.isActive) {
      return { evaluated: false };
    }

    protection.currentPrice = marketPrice;

    // 1. Ratchet Trailing Stop if active
    if (protection.stopLoss && protection.stopLoss.type === 'TRAILING') {
      protection.stopLoss = protectionEngine.evaluateTrailingStop(protection.stopLoss, marketPrice);
    }

    // 2. Check Triggers (Stop Loss or Take Profits)
    const { stopTriggered, triggeredTpTarget } = protectionEngine.checkTriggers(protection, marketPrice);

    if (stopTriggered && protection.stopLoss) {
      // Execute Stop Loss Exit
      const exitTokens = (protection.positionTokens * protection.stopLoss.portionPct) / 100;

      const res = protectionReservationManager.reserveInventory(positionId, exitTokens, protection.positionTokens);
      if (!res.success) {
        protection.health = 'BLOCKED';
        return { evaluated: true, protection };
      }

      const txHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
      protectionReservationManager.consume(res.reservation!.id);

      protection.stopLoss.isTriggered = true;
      protection.positionTokens -= exitTokens;
      if (protection.positionTokens <= 0) protection.isActive = false;

      const grossPnl = ((marketPrice - protection.entryPrice) / protection.entryPrice) * (exitTokens * protection.entryPrice);
      const fees = exitTokens * marketPrice * 0.004; // 0.4% fee + gas
      const netPnl = grossPnl - fees;

      const execRecord: ProtectionExecutionRecord = {
        id: `exec_sl_${Math.random().toString(36).substring(2, 8)}`,
        protectionId: protection.id,
        triggerType: 'STOP_LOSS',
        executedPrice: marketPrice,
        actualOutput: exitTokens * marketPrice,
        grossPnlUsd: parseFloat(grossPnl.toFixed(2)),
        netPnlUsd: parseFloat(netPnl.toFixed(2)),
        feesPaidUsd: parseFloat(fees.toFixed(2)),
        txHash,
        executedAt: new Date().toISOString()
      };

      const history = executionHistoryStore.get(positionId) || [];
      history.push(execRecord);
      executionHistoryStore.set(positionId, history);

      return { evaluated: true, executedType: 'STOP_LOSS', executionRecord: execRecord, protection };
    }

    if (triggeredTpTarget) {
      // Execute Take Profit Exit
      const exitTokens = (protection.positionTokens * triggeredTpTarget.portionPct) / 100;

      const res = protectionReservationManager.reserveInventory(positionId, exitTokens, protection.positionTokens);
      if (!res.success) {
        protection.health = 'BLOCKED';
        return { evaluated: true, protection };
      }

      const txHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
      protectionReservationManager.consume(res.reservation!.id);

      triggeredTpTarget.status = 'EXECUTED';
      triggeredTpTarget.executedAt = new Date().toISOString();
      protection.positionTokens -= exitTokens;

      // OCO Logic: If TP1 executed, apply auto-break-even stop adjustment
      if (triggeredTpTarget.level === 1 && protection.autoBreakEven) {
        const updated = protectionEngine.applyAutoBreakEven(protection);
        protection.stopLoss = updated.stopLoss;
      }

      if (protection.positionTokens <= 0) protection.isActive = false;

      const grossPnl = ((marketPrice - protection.entryPrice) / protection.entryPrice) * (exitTokens * protection.entryPrice);
      const fees = exitTokens * marketPrice * 0.004;
      const netPnl = grossPnl - fees;

      const execRecord: ProtectionExecutionRecord = {
        id: `exec_tp_${triggeredTpTarget.level}_${Math.random().toString(36).substring(2, 8)}`,
        protectionId: protection.id,
        triggerType: `TAKE_PROFIT_${triggeredTpTarget.level}` as any,
        executedPrice: marketPrice,
        actualOutput: exitTokens * marketPrice,
        grossPnlUsd: parseFloat(grossPnl.toFixed(2)),
        netPnlUsd: parseFloat(netPnl.toFixed(2)),
        feesPaidUsd: parseFloat(fees.toFixed(2)),
        txHash,
        executedAt: new Date().toISOString()
      };

      const history = executionHistoryStore.get(positionId) || [];
      history.push(execRecord);
      executionHistoryStore.set(positionId, history);

      return { evaluated: true, executedType: `TAKE_PROFIT_${triggeredTpTarget.level}`, executionRecord: execRecord, protection };
    }

    return { evaluated: true, protection };
  }

  public executeEmergencyExit(positionId: string, currentMarketPrice: number): {
    success: boolean;
    executionRecord?: ProtectionExecutionRecord;
    error?: string;
  } {
    if (process.env.NODE_ENV !== 'test') throw new Error('Emergency exits require a wallet-signed on-chain transaction.');
    const protection = protectionStore.get(positionId);
    if (!protection || protection.positionTokens <= 0) {
      return { success: false, error: 'Position not found or zero balance' };
    }

    const exitTokens = protection.positionTokens;
    const txHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;

    const grossPnl = ((currentMarketPrice - protection.entryPrice) / protection.entryPrice) * (exitTokens * protection.entryPrice);
    const fees = exitTokens * currentMarketPrice * 0.008; // higher emergency fee
    const netPnl = grossPnl - fees;

    const execRecord: ProtectionExecutionRecord = {
      id: `exec_emg_${Math.random().toString(36).substring(2, 8)}`,
      protectionId: protection.id,
      triggerType: 'EMERGENCY_EXIT',
      executedPrice: currentMarketPrice,
      actualOutput: exitTokens * currentMarketPrice,
      grossPnlUsd: parseFloat(grossPnl.toFixed(2)),
      netPnlUsd: parseFloat(netPnl.toFixed(2)),
      feesPaidUsd: parseFloat(fees.toFixed(2)),
      txHash,
      executedAt: new Date().toISOString()
    };

    protection.positionTokens = 0;
    protection.isActive = false;
    protection.health = 'INVALID';
    protection.updatedAt = new Date().toISOString();

    const history = executionHistoryStore.get(positionId) || [];
    history.push(execRecord);
    executionHistoryStore.set(positionId, history);

    return { success: true, executionRecord: execRecord };
  }

  public getExecutionHistory(positionId: string): ProtectionExecutionRecord[] {
    return executionHistoryStore.get(positionId) || [];
  }
}

export const protectionService = new ProtectionService();
