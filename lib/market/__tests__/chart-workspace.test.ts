import { describe, expect, it, vi } from 'vitest';
import type { Chart, Overlay } from 'klinecharts';
import { marketCapBasis, restoreDrawings, serializeDrawings, captureViewport, restoreViewport } from '../chart-workspace';
import { toKLineData } from '../kline-adapter';

describe('chart workspace accuracy', () => {
  it('uses measured circulating supply or a matching cap/price snapshot, never a default billion', () => {
    expect(marketCapBasis()).toBeUndefined();
    expect(marketCapBasis(undefined, 420_000_000, 2.1)).toBe(200_000_000);
    expect(marketCapBasis(200_000_000, 999, 1)).toBe(200_000_000);
    expect(marketCapBasis(NaN, 0, 1)).toBeUndefined();
    expect(marketCapBasis(undefined, Infinity, 1)).toBeUndefined();
  });
  it('rejects MCAP rendering without a measured basis, retaining price and volume precision', () => {
    const c = { time: 60, open: .00000001, high: .00000003, low: .00000001, close: .00000002, volume: 5, volumeUsd: .0000001 };
    expect(() => toKLineData(c, 'token', 'mcap')).toThrow(/measured/);
    expect(toKLineData(c, 'token', 'mcap', 100_000_000)).toMatchObject({ open: 1, close: 2, volume: 5, turnover: .0000001 });
    expect(toKLineData(c).close).toBe(c.close);
  });
  it('stores completed drawings in canonical USD and restores them across unit changes', () => {
    const overlay = { name: 'segment', id: 'a', currentStep: -1,
      points: [{ timestamp: 60_000, value: 200 }, { timestamp: 120_000, value: 300 }] } as Overlay;
    const stored = serializeDrawings([overlay], 100);
    expect(stored[0].points[0].value).toBe(2);
    expect(restoreDrawings(stored, 1)[0].points![1].value).toBe(3);
    expect(restoreDrawings(stored, 100)[0].points).toEqual(overlay.points);
    expect(serializeDrawings([{ ...overlay, currentStep: 1 }], 100)).toEqual([]);
    expect(restoreDrawings([{ ...stored[0], points: [{ timestamp: 1, value: NaN }] }], 1)).toEqual([]);
    expect(restoreDrawings([{ ...stored[0], name: 'untrusted-overlay' }], 1)).toEqual([]);
  });
  it('captures a time anchor rather than a loaded-array index and preserves follow mode', () => {
    const api = { getDataList: () => Array.from({ length: 100 }, (_, i) => ({ timestamp: i * 60000 })),
      getVisibleRange: () => ({ from: 20, to: 40 }), getBarSpace: () => ({ bar: 8 }),
      setBarSpace: vi.fn(), scrollToRealTime: vi.fn(), scrollToTimestamp: vi.fn(), scrollByDistance: vi.fn() };
    const view = captureViewport(api as unknown as Chart, false);
    expect(view).toEqual({ anchor: 1800000, following: false, barSpace: 8 });
    restoreViewport(api as unknown as Chart, view);
    expect(api.scrollToTimestamp).toHaveBeenCalledWith(1800000, 0);
    expect(api.scrollToRealTime).not.toHaveBeenCalled();
    restoreViewport(api as unknown as Chart, { ...view, following: true });
    expect(api.scrollToRealTime).toHaveBeenCalledWith(0);
  });
});
