/**
 * `IEmergencyController` — spec §33-35 (emergency controller, emergency
 * powers, pause granularity).
 *
 * Reuses `KillSwitchScope` (`'TRADING' | 'LAUNCHPAD'`) verbatim from
 * `lib/server/kill-switch.ts` — this interface is the documented on-chain
 * mirror of that exact, already-real off-chain mechanism, not a broader
 * "pause everything" primitive. Scope granularity is a deliberate choice:
 * see spec §35's "avoid PAUSE EVERYTHING when a narrower pause is possible."
 */

import type { Address, KillSwitchScope, TxSignature, UnixTimestamp } from './types';

export interface PauseHistoryEntry {
  paused: boolean;
  reason: string | null;
  actor: Address | null;
  at: UnixTimestamp;
}

export interface IEmergencyController {
  pause(scope: KillSwitchScope, reason: string, actor: Address): Promise<TxSignature>;
  resume(scope: KillSwitchScope, actor: Address): Promise<TxSignature>;
  isPaused(scope: KillSwitchScope): Promise<boolean>;
  getPauseHistory(scope: KillSwitchScope): Promise<PauseHistoryEntry[]>;
}
