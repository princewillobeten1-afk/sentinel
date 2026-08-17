import { ApiError } from './errors';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

/**
 * Simple memory rate limiter for API endpoints (e.g. 10 requests per minute per IP/Key).
 */
export function checkRateLimit(key: string, limit = 20, windowMs = 60000): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new ApiError('Too many authentication requests. Please try again shortly.', 429, 'RATE_LIMIT_EXCEEDED');
  }

  bucket.count++;
}
