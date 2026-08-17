/**
 * Platform-wide kill switch (Sprint 30 — Tier 3/4; `WALLET_TRANSFERS` added
 * for the self-custodial deposit/withdraw feature). In-memory,
 * `globalThis`-guarded. `TRADING`/`LAUNCHPAD` are only ever mutated via a
 * dual-control-approved admin action (`lib/server/dual-control.ts`) or the
 * circuit breaker (`lib/server/circuit-breaker.ts`).
 *
 * `WALLET_TRANSFERS` is deliberately single-admin, not dual-control — a
 * self-custodial send has no platform-side critical path once the user's
 * own wallet signs (nothing server-side can stop an already-broadcast
 * transaction), so this scope only gates whether the Send UI is shown and
 * whether the history-recording endpoint accepts new entries — a UI-level
 * circuit breaker for an incident in this feature's own construction/
 * validation logic, not a fund-moving control. See
 * docs/security/threat-model.md's "Wallet transfers" section.
 */

export type KillSwitchScope = 'TRADING' | 'LAUNCHPAD' | 'WALLET_TRANSFERS';
export type KillSwitchSource = 'ADMIN' | 'CIRCUIT_BREAKER';

export interface KillSwitchState {
  scope: KillSwitchScope;
  paused: boolean;
  reason: string | null;
  triggeredBy: string | null;
  triggeredAt: string | null;
  source: KillSwitchSource | null;
}

const SCOPES: KillSwitchScope[] = ['TRADING', 'LAUNCHPAD', 'WALLET_TRANSFERS'];

function initialState(scope: KillSwitchScope): KillSwitchState {
  return { scope, paused: false, reason: null, triggeredBy: null, triggeredAt: null, source: null };
}

class KillSwitchStore {
  private statesByScope = new Map<KillSwitchScope, KillSwitchState>(SCOPES.map((scope) => [scope, initialState(scope)]));

  isPaused(scope: KillSwitchScope): boolean {
    return this.statesByScope.get(scope)?.paused ?? false;
  }

  getState(scope: KillSwitchScope): KillSwitchState {
    return this.statesByScope.get(scope) ?? initialState(scope);
  }

  getAllStates(): KillSwitchState[] {
    return SCOPES.map((scope) => this.getState(scope));
  }

  pause(scope: KillSwitchScope, opts: { reason: string; triggeredBy: string; source: KillSwitchSource }): KillSwitchState {
    const state: KillSwitchState = {
      scope,
      paused: true,
      reason: opts.reason,
      triggeredBy: opts.triggeredBy,
      triggeredAt: new Date().toISOString(),
      source: opts.source,
    };
    this.statesByScope.set(scope, state);
    return state;
  }

  resume(scope: KillSwitchScope, opts: { triggeredBy: string }): KillSwitchState {
    const state: KillSwitchState = {
      scope,
      paused: false,
      reason: null,
      triggeredBy: opts.triggeredBy,
      triggeredAt: new Date().toISOString(),
      source: 'ADMIN',
    };
    this.statesByScope.set(scope, state);
    return state;
  }
}

const globalForKillSwitch = globalThis as unknown as { killSwitch?: KillSwitchStore };
export const killSwitch = globalForKillSwitch.killSwitch ?? new KillSwitchStore();
if (process.env.NODE_ENV !== 'production') globalForKillSwitch.killSwitch = killSwitch;
