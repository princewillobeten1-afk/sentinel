import { ApiError } from '@/lib/server/errors';

/**
 * Order lifecycle state machine (Phase 3 — Order Consolidation).
 *
 * Deliberately distinct from `lib/transaction/state-machine.ts`:
 *   - THIS models the user's standing intent to trade (is it filled yet?).
 *   - THAT models one on-chain attempt to execute it (is it signed yet?).
 * A single order can produce several transaction attempts — a retry after a
 * dropped broadcast doesn't move the order backwards — so the two lifecycles
 * cannot share one status column without losing information.
 *
 * The enforcement shape (explicit table + `isValidTransition` + a `transition`
 * that throws `INVALID_STATE_TRANSITION`) intentionally mirrors
 * `lib/transaction/state-machine.ts`, which is the codebase's established
 * precedent for this. Before Phase 3 the order status was a free-text string
 * (`app/api/v1/orders/route.ts` wrote `'QUOTING'`), so any value could follow
 * any other.
 */

export type OrderState =
  | 'CREATED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED';

export const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  // Accepted, not yet risk-checked or routed.
  CREATED: ['PENDING', 'CANCELLED', 'EXPIRED', 'FAILED'],
  // Risk-checked and queued for execution.
  PENDING: ['SUBMITTED', 'CANCELLED', 'FAILED', 'EXPIRED'],
  // Handed to execution; at least one transaction attempt exists.
  SUBMITTED: ['PARTIALLY_FILLED', 'FILLED', 'FAILED', 'EXPIRED'],
  // Partially executed — may still complete or be cancelled for the remainder.
  PARTIALLY_FILLED: ['FILLED', 'CANCELLED', 'EXPIRED'],
  // Terminal states.
  FILLED: [],
  CANCELLED: [],
  FAILED: [],
  EXPIRED: [],
};

/** States after which no further execution work should be attempted. */
export const TERMINAL_ORDER_STATES: OrderState[] = ['FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'];

export function isTerminalOrderState(state: OrderState): boolean {
  return TERMINAL_ORDER_STATES.includes(state);
}

export function isValidOrderTransition(from: OrderState, to: OrderState): boolean {
  const allowed = ORDER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Throws `INVALID_STATE_TRANSITION` (409) rather than returning false: an
 * illegal transition is a programming error or a race, never something a
 * caller should be able to shrug off and continue past.
 */
export function assertOrderTransition(from: OrderState, to: OrderState): void {
  if (from === to) {
    throw new ApiError(
      `Order is already in state ${to}.`,
      409,
      'INVALID_STATE_TRANSITION',
      { from, to },
    );
  }
  if (!isValidOrderTransition(from, to)) {
    throw new ApiError(
      `Illegal order transition ${from} → ${to}. Allowed from ${from}: ${ORDER_TRANSITIONS[from]?.join(', ') || 'none (terminal)'}.`,
      409,
      'INVALID_STATE_TRANSITION',
      { from, to, allowed: ORDER_TRANSITIONS[from] ?? [] },
    );
  }
}

/**
 * Resolves the state a fill implies, so callers can't disagree about what
 * "filled" means. Compared as strings-to-numbers at the boundary only; the
 * stored values stay NUMERIC in Postgres.
 */
export function stateForFill(filled: number, total: number): OrderState {
  if (filled <= 0) return 'SUBMITTED';
  if (filled >= total) return 'FILLED';
  return 'PARTIALLY_FILLED';
}
