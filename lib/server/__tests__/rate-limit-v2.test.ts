import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimitV2, getRateLimitHeaders, resetRateLimitState, TIER_LIMITS } from '../rate-limit-v2';

describe('rate-limit-v2', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it('allows requests under the tier limit and decrements remaining', () => {
    const first = checkRateLimitV2('key_a', 'FREE', '1.2.3.4');
    expect(first.allowed).toBe(true);
    const second = checkRateLimitV2('key_a', 'FREE', '1.2.3.4');
    expect(second.remaining).toBe(first.remaining - 1);
  });

  it('blocks once the per-minute + burst allowance is exhausted', () => {
    const limit = TIER_LIMITS.FREE.requestsPerMinute + TIER_LIMITS.FREE.burst;
    let last;
    for (let i = 0; i < limit; i += 1) {
      last = checkRateLimitV2('key_b', 'FREE', '1.2.3.5');
      expect(last.allowed).toBe(true);
    }
    const blocked = checkRateLimitV2('key_b', 'FREE', '1.2.3.5');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks separate buckets per API key', () => {
    const limit = TIER_LIMITS.FREE.requestsPerMinute + TIER_LIMITS.FREE.burst;
    for (let i = 0; i < limit; i += 1) checkRateLimitV2('key_c', 'FREE', '9.9.9.9');
    expect(checkRateLimitV2('key_c', 'FREE', '9.9.9.9').allowed).toBe(false);
    // A different key, same IP, has its own untouched bucket.
    expect(checkRateLimitV2('key_d', 'FREE', '9.9.9.9').allowed).toBe(true);
  });

  it('a higher tier gets a proportionally higher allowance', () => {
    const freeLimit = TIER_LIMITS.FREE.requestsPerMinute + TIER_LIMITS.FREE.burst;
    for (let i = 0; i < freeLimit; i += 1) checkRateLimitV2('key_e', 'PRO', '5.5.5.5');
    // PRO's allowance is far larger, so the same request count should still be allowed.
    expect(checkRateLimitV2('key_e', 'PRO', '5.5.5.5').allowed).toBe(true);
  });

  it('getRateLimitHeaders produces the expected header names', () => {
    const result = checkRateLimitV2('key_f', 'DEVELOPER', null);
    const headers = getRateLimitHeaders(result);
    expect(Object.keys(headers)).toEqual(expect.arrayContaining(['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']));
  });

  it('includes Retry-After only when the request was blocked', () => {
    const allowed = checkRateLimitV2('key_g', 'FREE', null);
    expect(getRateLimitHeaders(allowed)['Retry-After']).toBeUndefined();
  });

  it('works with no IP provided (skips the per-IP ceiling)', () => {
    expect(checkRateLimitV2('key_h', 'FREE', null).allowed).toBe(true);
  });
});
