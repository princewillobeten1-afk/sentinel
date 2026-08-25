import { describe, it, expect } from 'vitest';
import { toValueState, hasNumber, sortValue, describeState } from '../value-state';

describe('toValueState', () => {
  it('separates a measured zero from a missing value', () => {
    // The whole point: `—` used to mean both, and a reader takes it as
    // "checked, nothing to report".
    expect(toValueState(0)).toEqual({ kind: 'zero' });
    expect(toValueState(null)).toEqual({ kind: 'unavailable', reason: undefined });
  });

  it('classifies a real number', () => {
    expect(toValueState(18.4)).toEqual({ kind: 'value', value: 18.4 });
  });

  it('treats undefined and NaN as unavailable, not as zero', () => {
    expect(toValueState(undefined).kind).toBe('unavailable');
    expect(toValueState(Number.NaN).kind).toBe('unavailable');
  });

  it('reports pending ahead of everything else', () => {
    // A row renders before its analysis finishes; that must not read as "no
    // such value".
    expect(toValueState(null, { isPending: true }).kind).toBe('pending');
    expect(toValueState(42, { isPending: true }).kind).toBe('pending');
  });

  it('carries a reason for an unavailable value', () => {
    expect(toValueState(null, { reason: 'no pool for this mint' })).toEqual({
      kind: 'unavailable',
      reason: 'no pool for this mint',
    });
  });
});

describe('sortValue', () => {
  it('ranks unknowns below every measured value, including zero', () => {
    // A token whose concentration was never measured must not rank as though
    // it were measured at zero — which on this metric would be the best score.
    expect(sortValue(toValueState(5))).toBe(5);
    expect(sortValue(toValueState(0))).toBe(0);
    expect(sortValue(toValueState(null))).toBe(Number.NEGATIVE_INFINITY);
    expect(sortValue(toValueState(null, { isPending: true }))).toBe(Number.NEGATIVE_INFINITY);
  });

  it('orders a mixed list correctly', () => {
    const states = [null, 12, 0, undefined, 3].map((v) => toValueState(v as number | null));
    const sorted = [...states].sort((a, b) => sortValue(b) - sortValue(a));
    expect(sorted.map((s) => s.kind)).toEqual(['value', 'value', 'zero', 'unavailable', 'unavailable']);
  });
});

describe('hasNumber', () => {
  it('narrows only the value case', () => {
    expect(hasNumber(toValueState(7))).toBe(true);
    // Zero is measured but carries no `value` field, so colour ramps that
    // expect a number must not receive it unchecked.
    expect(hasNumber(toValueState(0))).toBe(false);
    expect(hasNumber(toValueState(null))).toBe(false);
  });
});

describe('describeState', () => {
  it('explains each state distinctly', () => {
    const label = 'Top 10 concentration';
    const texts = [
      describeState(toValueState(10), label),
      describeState(toValueState(0), label),
      describeState(toValueState(null, { isPending: true }), label),
      describeState(toValueState(null), label),
    ];
    expect(new Set(texts).size).toBe(4);
  });

  it('prefers a supplied reason', () => {
    expect(describeState(toValueState(null, { reason: 'no supply data' }), 'T10')).toBe('no supply data');
  });
});
