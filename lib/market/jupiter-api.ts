/**
 * Jupiter host + auth selection, in one place.
 *
 * With `JUPITER_API_KEY` set, every call goes to the keyed `api.jup.ag` with an
 * `x-api-key` header — a per-account quota instead of the shared, burst-limited
 * keyless pool on `lite-api.jup.ag` that was returning 429s at startup.
 * Without a key, behaviour is unchanged.
 *
 * Read lazily (functions, not constants) so tests and late-loaded env work.
 * Server-side only in effect: the key is not `NEXT_PUBLIC_`, so in a browser
 * bundle `process.env.JUPITER_API_KEY` is undefined and this falls back to the
 * keyless host — the key is never shipped to the client.
 */

export const JUPITER_KEYED_ORIGIN = 'https://api.jup.ag';
export const JUPITER_LITE_ORIGIN = 'https://lite-api.jup.ag';

export function jupiterApiKey(): string | undefined {
  const key = process.env.JUPITER_API_KEY?.trim();
  return key ? key : undefined;
}

export function jupiterOrigin(): string {
  return jupiterApiKey() ? JUPITER_KEYED_ORIGIN : JUPITER_LITE_ORIGIN;
}

export function jupiterHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = jupiterApiKey();
  return { accept: 'application/json', ...(key ? { 'x-api-key': key } : {}), ...extra };
}

