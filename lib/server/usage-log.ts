/**
 * API usage metering (Sprint 28 §61-63, §97).
 *
 * In-memory ring buffer, mirroring the spirit of `lib/server/audit.ts` and
 * the ad-hoc-shape precedent already set by
 * `lib/portfolio/service.ts`'s `recordPortfolioAccess` (which calls
 * `serverStore.recordAuditLog` directly with its own shape rather than
 * extending the closed `AuditEventInput` union). This is the same idea,
 * specialized for API traffic instead of auth/wallet events, and feeds the
 * developer dashboard's usage panel plus per-key analytics.
 */

export interface UsageLogEntry {
  requestId: string;
  apiKeyId: string | null;
  userId: string;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  occurredAt: string;
}

const MAX_ENTRIES = 50_000;

/**
 * `globalThis`-guarded so this survives Next.js dev-mode HMR/per-route
 * bundle recompilation — matches `lib/server/store.ts`/`api-keys.ts`'s
 * pattern. Without this, each API route can get its own compiled instance
 * of this module in dev mode, silently splitting usage history per-route
 * instead of tracking it platform-wide (found live while verifying Item 5's
 * platform-wide latency percentiles — a real pre-existing gap, not
 * introduced by this sprint's percentile work).
 */
const globalForUsageLog = globalThis as unknown as { __usageLogEntries?: UsageLogEntry[] };
const entries: UsageLogEntry[] = globalForUsageLog.__usageLogEntries ?? [];
if (process.env.NODE_ENV !== 'production') globalForUsageLog.__usageLogEntries = entries;

export function recordUsage(entry: UsageLogEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  sampleSize: number;
}

/**
 * Nearest-rank percentiles over raw latency samples (Sprint 31 — Item 5).
 * `usage-log.ts` already records every request's latency; this makes that
 * data actually answer "how slow is the tail," not just the mean, which
 * hides exactly the outliers that matter operationally.
 */
export function computePercentiles(latenciesMs: number[]): LatencyPercentiles {
  if (latenciesMs.length === 0) {
    return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const nearestRank = (percentile: number): number => {
    const rank = Math.ceil((percentile / 100) * sorted.length);
    const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
    return sorted[index];
  };

  return {
    p50: nearestRank(50),
    p95: nearestRank(95),
    p99: nearestRank(99),
    sampleSize: sorted.length,
  };
}

export interface UsageSummary {
  requestsToday: number;
  requestsThisMonth: number;
  averageLatencyMs: number;
  errorRate: number;
  rateLimitEvents: number;
  latencyPercentiles: LatencyPercentiles;
}

export function getUsageForUser(userId: string, sampleLimit = 5_000): UsageLogEntry[] {
  const forUser = entries.filter((entry) => entry.userId === userId);
  return forUser.slice(-sampleLimit);
}

function summarize(subset: UsageLogEntry[]): UsageSummary {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const today = subset.filter((entry) => Date.parse(entry.occurredAt) >= startOfDay);
  const thisMonth = subset.filter((entry) => Date.parse(entry.occurredAt) >= startOfMonth);
  const errors = subset.filter((entry) => entry.statusCode >= 500);
  const rateLimited = subset.filter((entry) => entry.statusCode === 429);

  const averageLatencyMs =
    subset.length > 0 ? Math.round(subset.reduce((sum, entry) => sum + entry.latencyMs, 0) / subset.length) : 0;

  return {
    requestsToday: today.length,
    requestsThisMonth: thisMonth.length,
    averageLatencyMs,
    errorRate: subset.length > 0 ? errors.length / subset.length : 0,
    rateLimitEvents: rateLimited.length,
    latencyPercentiles: computePercentiles(subset.map((entry) => entry.latencyMs)),
  };
}

export function summarizeUsage(userId: string): UsageSummary {
  return summarize(getUsageForUser(userId));
}

/** Platform-wide usage, unfiltered by user. Admin-only (Sprint 31 — Item 5). */
export function summarizeUsagePlatformWide(sampleLimit = 20_000): UsageSummary {
  return summarize(entries.slice(-sampleLimit));
}

export interface EndpointUsage {
  route: string;
  requests: number;
  averageLatencyMs: number;
  errorRate: number;
  latencyPercentiles: LatencyPercentiles;
}

function summarizeEndpoints(subset: UsageLogEntry[]): EndpointUsage[] {
  const byRoute = new Map<string, UsageLogEntry[]>();

  for (const entry of subset) {
    const list = byRoute.get(entry.route) ?? [];
    list.push(entry);
    byRoute.set(entry.route, list);
  }

  return [...byRoute.entries()]
    .map(([route, list]) => ({
      route,
      requests: list.length,
      averageLatencyMs: Math.round(list.reduce((sum, entry) => sum + entry.latencyMs, 0) / list.length),
      errorRate: list.filter((entry) => entry.statusCode >= 500).length / list.length,
      latencyPercentiles: computePercentiles(list.map((entry) => entry.latencyMs)),
    }))
    .sort((a, b) => b.requests - a.requests);
}

export function summarizeByEndpoint(userId: string): EndpointUsage[] {
  return summarizeEndpoints(getUsageForUser(userId));
}

/** Platform-wide per-endpoint breakdown, unfiltered by user. Admin-only. */
export function summarizeByEndpointPlatformWide(sampleLimit = 20_000): EndpointUsage[] {
  return summarizeEndpoints(entries.slice(-sampleLimit));
}

/** Test-only reset. */
export function resetUsageLogState(): void {
  entries.length = 0;
}
