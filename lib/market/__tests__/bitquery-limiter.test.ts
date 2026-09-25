import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acquireBitquerySlot, bitqueryLimiterStats, resetBitqueryLimiterForTests } from '../bitquery-limiter';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-25T10:00:00Z'));
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('BITQUERY_REQUEST_GAP_MS', '1000');
  resetBitqueryLimiterForTests();
});
afterEach(() => { resetBitqueryLimiterForTests(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('spaces account requests and prioritizes a waiting chart over ownership', async () => {
  await acquireBitquerySlot('launch');
  const order: string[] = [];
  const owner = acquireBitquerySlot('ownership').then(() => order.push('ownership'));
  const chart = acquireBitquerySlot('chart').then(() => order.push('chart'));
  expect(bitqueryLimiterStats().queued).toBe(2);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(order).toEqual(['chart']);
  await vi.advanceTimersByTimeAsync(1_000);
  await Promise.all([owner, chart]);
  expect(order).toEqual(['chart', 'ownership']);
});

it('removes a cancelled request before it reaches the provider', async () => {
  await acquireBitquerySlot('chart');
  const controller = new AbortController();
  const queued = acquireBitquerySlot('ownership', controller.signal);
  controller.abort();
  await expect(queued).rejects.toThrow('cancelled');
  expect(bitqueryLimiterStats().queued).toBe(0);
});
