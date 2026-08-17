import { describe, expect, it } from 'vitest';
import { clampUiScale, UI_SCALE_MIN, UI_SCALE_MAX, UI_SCALE_DEFAULT } from '../ui-scale';

describe('interface scale bounds', () => {
  it('defaults to 100%', () => {
    expect(UI_SCALE_DEFAULT).toBe(100);
  });

  it('spans 10% to 200%', () => {
    expect(UI_SCALE_MIN).toBe(10);
    expect(UI_SCALE_MAX).toBe(200);
  });

  it('passes through values already in range', () => {
    for (const v of [10, 50, 100, 125, 200]) {
      expect(clampUiScale(v)).toBe(v);
    }
  });

  it('clamps above the maximum rather than rejecting', () => {
    expect(clampUiScale(250)).toBe(200);
    expect(clampUiScale(10_000)).toBe(200);
  });

  it('clamps below the minimum', () => {
    expect(clampUiScale(5)).toBe(10);
    expect(clampUiScale(0)).toBe(10);
    expect(clampUiScale(-100)).toBe(10);
  });

  it('rounds fractional input to whole percent', () => {
    expect(clampUiScale(99.4)).toBe(99);
    expect(clampUiScale(99.6)).toBe(100);
  });

  it('falls back to the default for values that are not finite numbers', () => {
    // localStorage can hand back anything — `Number('')` is 0, `Number('abc')`
    // is NaN, and a corrupted entry must not leave the UI at an unusable size.
    expect(clampUiScale(NaN)).toBe(UI_SCALE_DEFAULT);
    expect(clampUiScale(Infinity)).toBe(UI_SCALE_DEFAULT);
    expect(clampUiScale(-Infinity)).toBe(UI_SCALE_DEFAULT);
    expect(clampUiScale(Number('not-a-number'))).toBe(UI_SCALE_DEFAULT);
  });

  it('never returns a value outside the range for any input', () => {
    const inputs = [-1e9, -1, 0, 9.99, 10, 55.5, 100, 199.5, 200, 200.01, 1e9, NaN, Infinity];
    for (const v of inputs) {
      const out = clampUiScale(v);
      expect(out).toBeGreaterThanOrEqual(UI_SCALE_MIN);
      expect(out).toBeLessThanOrEqual(UI_SCALE_MAX);
      expect(Number.isInteger(out)).toBe(true);
    }
  });

  it('is idempotent — clamping a clamped value changes nothing', () => {
    for (const v of [-50, 7, 33.3, 100, 201, 999]) {
      expect(clampUiScale(clampUiScale(v))).toBe(clampUiScale(v));
    }
  });
});
