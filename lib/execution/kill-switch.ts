/**
 * Emergency Execution Kill Switch & Blocklist Service (Sprint 47 §72-73, §90-91).
 */

import { dbRepository } from '../db/repository';
import { DbExecutionBlocklist } from '../db/schema';

export class ExecutionKillSwitch {
  private static instance: ExecutionKillSwitch;
  private isKillSwitchActive = false;
  private killSwitchReason?: string;
  private activatedBy?: string;
  private activatedAt?: string;

  private constructor() {}

  public static getInstance(): ExecutionKillSwitch {
    if (!ExecutionKillSwitch.instance) {
      ExecutionKillSwitch.instance = new ExecutionKillSwitch();
    }
    return ExecutionKillSwitch.instance;
  }

  public isEnabled(): boolean {
    return this.isKillSwitchActive;
  }

  public getStatus() {
    return {
      isActive: this.isKillSwitchActive,
      reason: this.killSwitchReason,
      activatedBy: this.activatedBy,
      activatedAt: this.activatedAt,
    };
  }

  public enableKillSwitch(reason: string, adminId: string): void {
    this.isKillSwitchActive = true;
    this.killSwitchReason = reason;
    this.activatedBy = adminId;
    this.activatedAt = new Date().toISOString();
  }

  public disableKillSwitch(adminId: string): void {
    this.isKillSwitchActive = false;
    this.killSwitchReason = undefined;
    this.activatedBy = undefined;
    this.activatedAt = undefined;
  }

  // Blocklist Management
  public blockTarget(
    targetType: 'TOKEN' | 'CONTRACT',
    targetValue: string,
    reason: string,
    adminId: string,
    expiresAt?: string
  ): DbExecutionBlocklist {
    return dbRepository.addToBlocklist({
      id: `blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      target_type: targetType,
      target_value: targetValue,
      reason,
      created_by: adminId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt || null,
    });
  }

  public unblockTarget(id: string): boolean {
    return dbRepository.removeFromBlocklist(id);
  }

  public isTargetBlocked(target: string): boolean {
    return dbRepository.isTargetBlocklisted(target);
  }

  public getBlocklist(): DbExecutionBlocklist[] {
    return dbRepository.getBlocklist();
  }

  public reset(): void {
    this.isKillSwitchActive = false;
    this.killSwitchReason = undefined;
  }
}

export const executionKillSwitch = ExecutionKillSwitch.getInstance();
