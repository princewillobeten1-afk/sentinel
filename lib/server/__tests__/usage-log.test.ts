import { afterEach, describe, expect, it } from 'vitest';
import {
  computePercentiles,
  recordUsage,
  resetUsageLogState,
  summarizeByEndpoint,
  summarizeByEndpointPlatformWide,
  summarizeUsage,
  summarizeUsagePlatformWide,
  type UsageLogEntry,
} from '../usage-log';

describe('computePercentiles', () => {
  it('returns all zeros for an empty sample', () => {
    expect(computePercentiles([])).toEqual({ p50: 0, p95: 0, p99: 0, sampleSize: 0 });
  });

  it('returns the single value for every percentile with one sample', () => {
    expect(computePercentiles([42])).toEqual({ p50: 42, p95: 42, p99: 42, sampleSize: 1 });
  });

  it('matches hand-verified nearest-rank values for 1..100', () => {
    const latencies = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(computePercentiles(latencies)).toEqual({ p50: 50, p95: 95, p99: 99, sampleSize: 100 });
  });

  it('matches hand-verified nearest-rank values for a small unsorted sample', () => {
    // nearest-rank on [10,20,30]: p50 -> rank ceil(1.5)=2 -> 20; p95/p99 -> rank 3 -> 30
    expect(computePercentiles([30, 10, 20])).toEqual({ p50: 20, p95: 30, p99: 30, sampleSize: 3 });
  });

  it('does not mutate the input array', () => {
    const input = [30, 10, 20];
    computePercentiles(input);
    expect(input).toEqual([30, 10, 20]);
  });
});

function entry(overrides: Partial<UsageLogEntry> = {}): UsageLogEntry {
  return {
    requestId: 'req_1',
    apiKeyId: null,
    userId: 'user_a',
    route: '/api/v1/discovery/trending',
    method: 'GET',
    statusCode: 200,
    latencyMs: 100,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('summarizeUsage / summarizeByEndpoint', () => {
  afterEach(() => {
    resetUsageLogState();
  });

  it('includes latencyPercentiles scoped to the requesting user only', () => {
    recordUsage(entry({ userId: 'user_a', latencyMs: 100 }));
    recordUsage(entry({ userId: 'user_a', latencyMs: 200 }));
    recordUsage(entry({ userId: 'user_b', latencyMs: 9000 }));

    const summary = summarizeUsage('user_a');
    expect(summary.latencyPercentiles.sampleSize).toBe(2);
    expect(summary.latencyPercentiles.p99).toBeLessThan(9000);
  });

  it('includes latencyPercentiles per endpoint', () => {
    recordUsage(entry({ userId: 'user_a', route: '/a', latencyMs: 100 }));
    recordUsage(entry({ userId: 'user_a', route: '/a', latencyMs: 300 }));
    recordUsage(entry({ userId: 'user_a', route: '/b', latencyMs: 50 }));

    const byEndpoint = summarizeByEndpoint('user_a');
    const routeA = byEndpoint.find((e) => e.route === '/a');
    expect(routeA?.latencyPercentiles.sampleSize).toBe(2);
  });
});

describe('summarizeUsagePlatformWide / summarizeByEndpointPlatformWide', () => {
  afterEach(() => {
    resetUsageLogState();
  });

  it('aggregates across all users, unlike the per-user summary', () => {
    recordUsage(entry({ userId: 'user_a', latencyMs: 100 }));
    recordUsage(entry({ userId: 'user_b', latencyMs: 200 }));
    recordUsage(entry({ userId: 'user_c', latencyMs: 300 }));

    const platform = summarizeUsagePlatformWide();
    expect(platform.latencyPercentiles.sampleSize).toBe(3);

    const perUser = summarizeUsage('user_a');
    expect(perUser.latencyPercentiles.sampleSize).toBe(1);
  });

  it('breaks down platform-wide latency by endpoint across users', () => {
    recordUsage(entry({ userId: 'user_a', route: '/shared', latencyMs: 100 }));
    recordUsage(entry({ userId: 'user_b', route: '/shared', latencyMs: 500 }));

    const byEndpoint = summarizeByEndpointPlatformWide();
    const shared = byEndpoint.find((e) => e.route === '/shared');
    expect(shared?.requests).toBe(2);
    expect(shared?.latencyPercentiles.sampleSize).toBe(2);
  });
});
