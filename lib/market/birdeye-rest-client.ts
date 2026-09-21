import 'server-only';

import { env } from '@/lib/server/env';
import { fetchWithTimeout } from '@/lib/api/birdeye/http-timeout';
import { acquireBirdeyeSlot } from '@/lib/market/enrichment/birdeye-limiter';

const BASE_URL = 'https://public-api.birdeye.so';

export class BirdeyeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'BirdeyeApiError';
  }
}

interface BirdeyeEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared GET helper for Birdeye's REST API. Server-only — holds the API key.
 * Throws `BirdeyeApiError` on a non-2xx response (after retries) or
 * `{ success: false }`.
 *
 * Retries on 429 with backoff (honoring `Retry-After` when present): callers
 * in this codebase routinely fire several Birdeye calls concurrently via
 * `Promise.all` (e.g. `getTokenMarketData`'s three parallel lookups), which
 * can burst past a per-second rate limit even when the account's overall
 * quota is generous — confirmed during manual testing, where sequential curl
 * calls succeeded but the same calls fired concurrently through this client
 * got 429'd. Retrying here fixes it at the one place all callers share,
 * rather than asking every call site to manage its own backoff.
 */
export async function birdeyeGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  chain = 'solana',
): Promise<T> {
  const apiKey = env.getRequiredEnv('BIRDEYE_API_KEY');

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let lastError: BirdeyeApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // All server-side consumers share the account-level gate. Retrying with
    // jitter alone still lets unrelated pages burst against the same key.
    await acquireBirdeyeSlot('background');
    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': chain,
        Accept: 'application/json',
      },
      // Market data changes second-to-second; never let Next.js cache this.
      cache: 'no-store',
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      // Jitter matters here, not just backoff: callers in this codebase fire
      // several Birdeye requests concurrently via Promise.all, so without
      // jitter every one of them retries on the exact same schedule and they
      // just collide again on the next attempt too (confirmed during manual
      // testing — a 5-way concurrent burst kept 429ing in lockstep across
      // three fixed-delay retries). Full jitter spreads retries out so the
      // pack de-synchronizes instead of re-bursting together.
      const delay = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : Math.random() * BASE_RETRY_DELAY_MS * 2 ** attempt;
      lastError = new BirdeyeApiError(`Birdeye ${path} responded 429`, 429, path);
      await sleep(delay);
      continue;
    }

    if (!response.ok) {
      throw new BirdeyeApiError(`Birdeye ${path} responded ${response.status}`, response.status, path);
    }

    const body = (await response.json()) as BirdeyeEnvelope<T>;
    if (!body.success) {
      throw new BirdeyeApiError(body.message ?? `Birdeye ${path} returned success:false`, response.status, path);
    }

    return body.data;
  }

  throw lastError ?? new BirdeyeApiError(`Birdeye ${path} failed after ${MAX_RETRIES} retries`, 429, path);
}
