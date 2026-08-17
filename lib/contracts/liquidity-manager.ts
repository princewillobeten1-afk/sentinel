/**
 * `ILiquidityManager` — spec §15-18 (liquidity migration, manager,
 * locking, ownership).
 *
 * `migrateLiquidity` formalizes `lib/launchpad/graduation.ts#migrateLiquidity`'s
 * existing stub shape (a `console.log` + `setTimeout` + hardcoded
 * `'0xmockDexPoolAddress'`) — this interface types that shape, it does not
 * make it real. See docs/contracts/05-liquidity-manager.md.
 */

import type { Address, BigNumberish, TxSignature, UnixTimestamp } from './types';

/** 30–365 days, per `docs/architecture/11-launchpad-and-reputation.md`'s published invariant. */
export const LIQUIDITY_LOCK_DURATION_DAYS = { MIN: 30, MAX: 365 } as const;

export interface LiquidityLockRecord {
  bondingCurveAddress: Address;
  dexPoolAddress: Address;
  lockedAmount: BigNumberish;
  lockDurationDays: number;
  lockStart: UnixTimestamp;
  lockEnd: UnixTimestamp;
  unlockTxSignature?: TxSignature;
}

export interface LiquidityLockValidation {
  valid: boolean;
  reason?: string;
}

export interface ILiquidityManager {
  /** Formalizes `GraduationManager.migrateLiquidity(launchId, reserveBalance, remainingTokens)`'s existing (stub) shape. */
  migrateLiquidity(launchId: string, reserveBalance: BigNumberish, remainingTokens: BigNumberish): Promise<LiquidityLockRecord>;

  getLockStatus(dexPoolAddress: Address): Promise<LiquidityLockRecord | null>;

  /** True only while `now < lockEnd` — a lock that has simply expired is not "locked," even if never explicitly unlocked. */
  isLiquidityLocked(dexPoolAddress: Address): Promise<boolean>;

  /** Pure — enforces `LIQUIDITY_LOCK_DURATION_DAYS`. */
  validateLockDuration(days: number): LiquidityLockValidation;
}
