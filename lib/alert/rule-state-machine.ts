import { ApiError } from '@/lib/server/errors';

/**
 * Alert RULE lifecycle (Phase 4).
 *
 * Not to be confused with `AlertReadState` in `./types.ts`:
 *   - This is the standing subscription — is the rule watching?
 *   - `AlertReadState` (UNREAD/READ/ACTIONED/DISMISSED) is one user's
 *     interaction with one firing of that rule.
 * The two were being conflated; a paused RULE and a dismissed EVENT are
 * unrelated facts. Before Phase 4 the rule lifecycle didn't exist at all —
 * `alerts.enabled` was a bare boolean, which cannot express EXPIRED or
 * distinguish "deleted" from "never created".
 *
 * Enforcement shape matches `lib/order/state-machine.ts` and
 * `lib/transaction/state-machine.ts`.
 */

export type AlertRuleState = 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'EXPIRED' | 'DELETED';

export const ALERT_RULE_TRANSITIONS: Record<AlertRuleState, AlertRuleState[]> = {
  // Watching. It can fire, be paused by the user, lapse, or be removed.
  ACTIVE: ['PAUSED', 'TRIGGERED', 'EXPIRED', 'DELETED'],
  // User-suspended. Resumable.
  PAUSED: ['ACTIVE', 'EXPIRED', 'DELETED'],
  // Just fired. Returns to ACTIVE once its cooldown elapses — firing is not
  // terminal, which is exactly why a boolean `enabled` couldn't model this.
  TRIGGERED: ['ACTIVE', 'PAUSED', 'EXPIRED', 'DELETED'],
  // Lapsed (e.g. a time-bounded rule). Only removable.
  EXPIRED: ['DELETED'],
  // Soft-deleted, terminal. Its past events survive.
  DELETED: [],
};

export function isValidAlertRuleTransition(from: AlertRuleState, to: AlertRuleState): boolean {
  const allowed = ALERT_RULE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertAlertRuleTransition(from: AlertRuleState, to: AlertRuleState): void {
  if (from === to) {
    throw new ApiError(`Alert rule is already ${to}.`, 409, 'INVALID_STATE_TRANSITION', { from, to });
  }
  if (!isValidAlertRuleTransition(from, to)) {
    throw new ApiError(
      `Illegal alert rule transition ${from} → ${to}. Allowed from ${from}: ${ALERT_RULE_TRANSITIONS[from]?.join(', ') || 'none (terminal)'}.`,
      409,
      'INVALID_STATE_TRANSITION',
      { from, to, allowed: ALERT_RULE_TRANSITIONS[from] ?? [] },
    );
  }
}

/** Read state of a single firing — separate lifecycle, separate table column. */
export type AlertEventReadState = 'UNREAD' | 'READ' | 'ACTIONED' | 'DISMISSED';

export const READ_STATE_TRANSITIONS: Record<AlertEventReadState, AlertEventReadState[]> = {
  UNREAD: ['READ', 'DISMISSED'],
  READ: ['ACTIONED', 'DISMISSED'],
  // Terminal: acting on or dismissing a firing is final.
  ACTIONED: [],
  DISMISSED: [],
};

export function assertReadStateTransition(from: AlertEventReadState, to: AlertEventReadState): void {
  if (from === to) {
    throw new ApiError(`Alert is already ${to}.`, 409, 'INVALID_STATE_TRANSITION', { from, to });
  }
  const allowed = READ_STATE_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new ApiError(
      `Illegal read-state transition ${from} → ${to}.`,
      409,
      'INVALID_STATE_TRANSITION',
      { from, to, allowed: allowed ?? [] },
    );
  }
}
