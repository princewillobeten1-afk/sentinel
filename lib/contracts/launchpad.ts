/**
 * `ILaunchpad` / `ILaunchController` — spec §9-11 (Launchpad contract,
 * launch states, launch parameters).
 *
 * `LAUNCH_STATE_TRANSITIONS` is the canonical state machine — the same
 * `LaunchState` enum `lib/launchpad/types.ts` already defines and
 * `app/api/v1/launches/**` already uses, now with its valid-transition graph
 * made explicit and type-checked. `docs/contracts/03-launchpad-and-launch-controller.md`
 * renders its diagram *from* this table, not the other way around, so the
 * doc can't drift from what the code actually allows.
 *
 * (Sprint 36 reconciliation: an older, informal `DRAFT/READY/LAUNCHING`
 * vocabulary used to coexist in a since-deleted, unauthenticated route tree
 * — `LaunchState` below was already the real one, used by the live,
 * gateway-wired API.)
 */

import { LaunchState } from '@/lib/launchpad/types';
import type { Address, LaunchConfig, LaunchRiskScore, TxSignature, UnixTimestamp } from './types';

export const LAUNCH_STATE_TRANSITIONS: Record<LaunchState, LaunchState[]> = {
  [LaunchState.CREATED]: [LaunchState.VALIDATING, LaunchState.CANCELLED],
  [LaunchState.VALIDATING]: [LaunchState.DEPLOYED, LaunchState.CREATED, LaunchState.CANCELLED],
  [LaunchState.DEPLOYED]: [LaunchState.LIVE, LaunchState.CANCELLED],
  [LaunchState.LIVE]: [LaunchState.GRADUATING, LaunchState.PAUSED, LaunchState.CANCELLED],
  [LaunchState.GRADUATING]: [LaunchState.GRADUATED, LaunchState.LIVE],
  [LaunchState.GRADUATED]: [],
  [LaunchState.PAUSED]: [LaunchState.LIVE, LaunchState.CANCELLED],
  [LaunchState.CANCELLED]: [],
};

export function isValidLaunchStateTransition(from: LaunchState, to: LaunchState): boolean {
  return LAUNCH_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface LaunchRecord {
  launchId: string;
  config: LaunchConfig;
  state: LaunchState;
  tokenAddress?: Address;
  bondingCurveAddress?: Address;
  creatorWallet: Address;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export interface ILaunchpad {
  createLaunch(config: LaunchConfig, creatorWallet: Address): Promise<LaunchRecord>;
  getLaunch(launchId: string): Promise<LaunchRecord | null>;
  listLaunches(filter?: { state?: LaunchState; creatorWallet?: Address }): Promise<LaunchRecord[]>;

  /** Must reject via `isValidLaunchStateTransition` before mutating state — an on-chain program enforces this the same way a state machine's guard clause would. */
  transitionState(launchId: string, to: LaunchState, reason?: string): Promise<LaunchRecord>;
}

export interface LaunchDeploymentResult {
  launchId: string;
  tokenAddress: Address;
  bondingCurveAddress: Address;
  txSignature: TxSignature;
}

export interface ILaunchController {
  /** Signature matches `lib/launchpad/engine.ts#preflightAnalysis` exactly — same real risk engine underneath. */
  preflightAnalysis(config: LaunchConfig, creatorWallet: Address): Promise<LaunchRiskScore>;

  deployLaunch(config: LaunchConfig, creatorWallet: Address): Promise<LaunchDeploymentResult>;
  pauseLaunch(launchId: string, reason: string, actor: Address): Promise<void>;
  resumeLaunch(launchId: string, actor: Address): Promise<void>;
  cancelLaunch(launchId: string, reason: string, actor: Address): Promise<void>;
}
