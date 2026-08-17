/**
 * Tier-aware rate limiting for the developer API (Sprint 28 §50-52).
 *
 * Deliberately a NEW file, not a rewrite of `lib/server/rate-limit.ts` —
 * that one is a simple in-memory limiter already used by the auth-challenge
 * flow (`app/api/v1/auth/challenge`), and changing its behavior would risk
 * regressing existing callers that have nothing to do with API keys. This
 * file is scoped entirely to the API-key gateway path.
 *
 * Limits are per-API-key (the dimension a developer actually sees and
 * controls, reflected in the X-RateLimit-* headers) plus a coarse per-IP
 * ceiling layered on top purely as abuse protection — that ceiling never
 * appears in headers, since it isn't something the developer can tune.
 *
 * The exact numbers below are illustrative defaults, not numbers specified
 * anywhere in the source sprint doc — tune them against real usage once
 * there is any.
 */

export const RATE_LIMIT_TIERS = ['FREE', 'DEVELOPER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type RateLimitTier = (typeof RATE_LIMIT_TIERS)[number];

export interface TierLimits {
  /** Sustained requests per minute. */
  requestsPerMinute: number;
  /** Hard daily cap. */
  requestsPerDay: number;
  /** Short burst allowance on top of the steady per-minute rate. */
  burst: number;
  /** Max concurrent WebSocket topic subscriptions per connection. */
  wsSubscriptionsPerConnection: number;
}

export const TIER_LIMITS: Record<RateLimitTier, TierLimits> = {
  FREE: { requestsPerMinute: 30, requestsPerDay: 5_000, burst: 10, wsSubscriptionsPerConnection: 5 },
  DEVELOPER: { requestsPerMinute: 120, requestsPerDay: 50_000, burst: 30, wsSubscriptionsPerConnection: 20 },
  PRO: { requestsPerMinute: 600, requestsPerDay: 500_000, burst: 100, wsSubscriptionsPerConnection: 100 },
  BUSINESS: { requestsPerMinute: 3_000, requestsPerDay: 5_000_000, burst: 300, wsSubscriptionsPerConnection: 500 },
  // Enterprise limits are negotiated per account; these are just a generous
  // ceiling so an Enterprise key isn't accidentally throttled by default.
  ENTERPRISE: { requestsPerMinute: 20_000, requestsPerDay: 50_000_000, burst: 2_000, wsSubscriptionsPerConnection: 5_000 },
};

/** Coarse, per-IP, not tunable by tier — abuse protection only. */
const IP_CEILING_PER_MINUTE = 600;

interface Bucket {
  count: number;
  windowStartedAt: number;
  dayCount: number;
  dayStartedAt: number;
}

const perKeyBuckets = new Map<string, Bucket>();
const perIpBuckets = new Map<string, Bucket>();

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getOrCreateBucket(store: Map<string, Bucket>, key: string, now: number): Bucket {
  const existing = store.get(key);
  if (existing) return existing;
  const fresh: Bucket = { count: 0, windowStartedAt: now, dayCount: 0, dayStartedAt: now };
  store.set(key, fresh);
  return fresh;
}

function rollWindows(bucket: Bucket, now: number): void {
  if (now - bucket.windowStartedAt >= MINUTE_MS) {
    bucket.count = 0;
    bucket.windowStartedAt = now;
  }
  if (now - bucket.dayStartedAt >= DAY_MS) {
    bucket.dayCount = 0;
    bucket.dayStartedAt = now;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the per-minute window resets. */
  resetAt: number;
  /** Seconds the caller should wait before retrying, only set when `allowed` is false. */
  retryAfterSeconds?: number;
}

/**
 * Checks (and, if allowed, consumes) one request against a key's tier bucket
 * and the coarse per-IP ceiling. Never throws — callers decide how to react
 * to `allowed: false` (the gateway turns it into a 429).
 */
export function checkRateLimitV2(apiKeyId: string, tier: RateLimitTier, ip: string | null): RateLimitResult {
  const now = Date.now();
  const limits = TIER_LIMITS[tier];

  const keyBucket = getOrCreateBucket(perKeyBuckets, apiKeyId, now);
  rollWindows(keyBucket, now);

  const effectiveLimit = limits.requestsPerMinute + limits.burst;
  const resetAt = Math.ceil((keyBucket.windowStartedAt + MINUTE_MS) / 1000);

  if (keyBucket.dayCount >= limits.requestsPerDay) {
    return { allowed: false, limit: limits.requestsPerDay, remaining: 0, resetAt, retryAfterSeconds: Math.ceil((keyBucket.dayStartedAt + DAY_MS - now) / 1000) };
  }

  if (keyBucket.count >= effectiveLimit) {
    return { allowed: false, limit: effectiveLimit, remaining: 0, resetAt, retryAfterSeconds: Math.ceil((keyBucket.windowStartedAt + MINUTE_MS - now) / 1000) };
  }

  if (ip) {
    const ipBucket = getOrCreateBucket(perIpBuckets, ip, now);
    rollWindows(ipBucket, now);
    if (ipBucket.count >= IP_CEILING_PER_MINUTE) {
      return { allowed: false, limit: effectiveLimit, remaining: 0, resetAt, retryAfterSeconds: Math.ceil((ipBucket.windowStartedAt + MINUTE_MS - now) / 1000) };
    }
    ipBucket.count += 1;
  }

  keyBucket.count += 1;
  keyBucket.dayCount += 1;

  return { allowed: true, limit: effectiveLimit, remaining: Math.max(0, effectiveLimit - keyBucket.count), resetAt };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };
  if (result.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}

/** Test-only reset so specs don't leak state across cases. */
export function resetRateLimitState(): void {
  perKeyBuckets.clear();
  perIpBuckets.clear();
}
