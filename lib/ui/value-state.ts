/**
 * Four states for a numeric field, because one em-dash cannot carry them.
 *
 * `T10: —` currently means "this field does not exist in the response". A user
 * reads it as "checked, nothing to report" — which is the opposite of true, and
 * on an ownership metric it is the difference between a token that was audited
 * and one that never was.
 *
 * These must look different:
 *
 *  - **value**       — measured, and non-zero.
 *  - **zero**        — measured, and it is genuinely zero. A real finding.
 *  - **pending**     — being computed. The row rendered first, on purpose.
 *  - **unavailable** — cannot be computed for this token, and we know that.
 *
 * `pending` is what lets slow analysis ship incrementally: rows appear
 * immediately, values fill in behind them, and the reader can tell which is
 * which instead of watching a dash that may or may not ever change.
 */

export type ValueState<T = number> =
  | { kind: 'value'; value: T }
  | { kind: 'zero' }
  | { kind: 'stale'; value: T }
  | { kind: 'pending' }
  | { kind: 'unavailable'; reason?: string };

/**
 * Classifies a nullable number.
 *
 * `isPending` has to be passed explicitly: a null cannot tell you whether it is
 * still loading or will never arrive, and guessing is what produced the single
 * ambiguous dash in the first place.
 */
export function toValueState(
  value: number | null | undefined,
  options: { isPending?: boolean; isStale?: boolean; reason?: string } = {},
): ValueState<number> {
  if (options.isPending) return { kind: 'pending' };
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { kind: 'unavailable', reason: options.reason };
  }
  if (options.isStale) return { kind: 'stale', value };
  return value === 0 ? { kind: 'zero' } : { kind: 'value', value };
}

/** True when the state carries a number the caller can compare or colour. */
export function hasNumber(state: ValueState<number>): state is { kind: 'value'; value: number } {
  return state.kind === 'value';
}

/**
 * Sort key that keeps unknowns out of the winners' end.
 *
 * Unavailable and pending sort below every real value, including a real zero —
 * a token whose concentration was never measured must not rank as though it
 * were measured at zero.
 */
export function sortValue(state: ValueState<number>): number {
  switch (state.kind) {
    case 'value':
      return state.value;
    case 'zero':
      return 0;
    case 'stale':
      return state.value;
    default:
      return Number.NEGATIVE_INFINITY;
  }
}

/** Default wording, so every surface explains the states the same way. */
export function describeState(state: ValueState<number>, label: string): string {
  switch (state.kind) {
    case 'value':
      return `${label}: measured`;
    case 'zero':
      return `${label}: measured, and it is zero`;
    case 'stale':
      return `${label}: last measured value is stale`;
    case 'pending':
      return `${label} is still being computed`;
    case 'unavailable':
      return state.reason ?? `${label} could not be computed for this token`;
  }
}
