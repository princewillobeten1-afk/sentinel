/**
 * Shared outbound-timeout helper for both Birdeye HTTP clients
 * (`lib/api/birdeye/client.ts`, `lib/market/birdeye-rest-client.ts`). A hung
 * upstream call would otherwise tie up a request handler indefinitely — this
 * process has no autoscaling to absorb that (Sprint 31 — Item 2).
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request to ${url} timed out after ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
