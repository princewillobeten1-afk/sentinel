/**
 * De-duplicates concurrent identical requests.
 *
 * Measured on `/discover` before this existed: 61 feed requests in 32 seconds,
 * with `discovery/new` fetched **24 times** against 8 for every other section —
 * the same URL, in flight simultaneously, three times over. Each caller opened
 * its own request because nothing coordinated them.
 *
 * The key is the URL and nothing else. A cache-buster query parameter would
 * make every key unique, which defeats both this and any HTTP caching the
 * browser would otherwise give for free.
 */

const inflight = new Map<string, Promise<unknown>>();

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * Fetches JSON, sharing one in-flight promise per URL.
 *
 * The entry is removed in `finally`, so a failure does not poison the key for
 * later callers — only genuinely concurrent requests are shared.
 */
export function fetchOnce<T>(url: string, init?: RequestInit): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const request = fetch(url, { ...init, cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new HttpError(res.status, url);
      return (await res.json()) as T;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
}

/** Number of requests currently in flight. Test and diagnostic seam. */
export function inflightCount(): number {
  return inflight.size;
}

/** Test seam — drops every tracked request without cancelling it. */
export function __resetFetchOnce(): void {
  inflight.clear();
}
