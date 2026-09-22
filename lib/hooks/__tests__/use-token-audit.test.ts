// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTokenAudit } from '../use-token-audit';
import { composeTokenAudit } from '@/lib/trading/audit-model';

function audit(mint = 'mint', pending = false) {
  const evidence = { status: 'measured' as const, source: 'test', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  return composeTokenAudit(mint, { devHoldingsPct: 2, ownershipEvidence: evidence }, null, null, evidence, pending);
}
const response = (data = audit()) => ({ ok: true, json: async () => ({ success: true, data }) });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('polls pending evidence, retains metadata, then slows down for completed audits', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response(audit('mint', true))).mockResolvedValue(response());
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useTokenAudit('mint', true));
  await act(async () => {});
  expect(result.current.data?.holderAuditPending).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
  expect(result.current.data?.holderAuditPending).toBe(false);
  expect(result.current.data?.ownershipEvidence.source).toBe('test');
  await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('marks retained values stale on failure and recovers with manual retry', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(response()).mockResolvedValue({ ok: false, status: 503 });
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useTokenAudit('mint', true));
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(result.current.error).toContain('503');
  expect(result.current.data?.devBalancePct).toBe(2);
  expect(result.current.data?.ownershipEvidence.status).toBe('stale');
  fetcher.mockResolvedValue(response());
  await act(async () => { result.current.refresh(); });
  expect(result.current.error).toBeNull();
  expect(result.current.data?.ownershipEvidence.status).toBe('measured');
});

it('clears old token data immediately and ignores late replies after switching tokens', async () => {
  let finish: (value: unknown) => void = () => {};
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response(audit('next')));
  vi.stubGlobal('fetch', fetcher);
  const { result, rerender, unmount } = renderHook(({ mint }) => useTokenAudit(mint, true), { initialProps: { mint: 'mint' } });
  rerender({ mint: 'next' });
  expect(result.current.data).toBeNull();
  await act(async () => {});
  await act(async () => { finish(response(audit('mint'))); });
  expect(result.current.data?.token).toBe('next');
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not poll inactive or hidden tabs and resumes when visible', async () => {
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetcher);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const { rerender } = renderHook(({ active }) => useTokenAudit('mint', active), { initialProps: { active: false } });
  rerender({ active: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(fetcher).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('times out a hung request without overlapping polls', async () => {
  const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useTokenAudit('mint', true));
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(result.current.error).toContain('timed out');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('rejects malformed success payloads instead of getting stuck in loading', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { token: 'mint', holderAuditPending: false } }) }));
  const { result } = renderHook(() => useTokenAudit('mint', true));
  await act(async () => {});
  expect(result.current.error).toContain('invalid response');
  expect(result.current.refreshing).toBe(false);
});
