// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('deduplicates read-only GET telemetry and clears failed readings without a Server Action', async () => {
  vi.useFakeTimers();
  const summary = { solPriceUsd: 0, updatedAt: '2026-09-20T00:00:00Z', freshness: 'fresh' };
  const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { summary } }) });
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => [useMarketSummary(), useMarketSummary()]);
  await act(async () => {});
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/market/live/summary');
  expect(fetcher.mock.calls[0][1].method).toBeUndefined();
  expect(result.current[0].marketSummary.solPriceUsd).toBe(0);
  expect(result.current[1].marketSummary.solPriceUsd).toBe(0);
  fetcher.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { message: 'Unavailable' } }) });
  await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
  expect(result.current[0].marketSummary).toBeNull();
  expect(result.current[1].marketSummary).toBeNull();
});
