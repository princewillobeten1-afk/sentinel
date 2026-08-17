/**
 * Reads the standard API envelope.
 *
 * Every `/api/v1` route returns through `lib/server/api.ts`, which wraps
 * success payloads as `{ success: true, data: <payload> }` and failures as
 * `{ success: false, error: { message, code, details } }`.
 *
 * Call sites that reach past `fetch` for `body.alerts` or `body.orders` find
 * `undefined` — the payload is one level down. That failure is silent: the view
 * renders its empty state and looks like a user with no data rather than a
 * wiring bug, which is exactly how it went unnoticed. This is the one place that
 * knows the envelope's shape.
 */

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Unwraps a response, throwing `ApiRequestError` on any failure.
 *
 * `fallbackMessage` is used only when the server gave no usable message —
 * a 502 from a proxy, or a body that is not JSON at all.
 */
export async function readApiData<T = unknown>(
  res: Response,
  fallbackMessage = 'Request failed',
): Promise<T> {
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiRequestError(
      body?.error?.message || body?.message || `${fallbackMessage} (${res.status})`,
      res.status,
      body?.error?.code,
    );
  }

  // Routes that predate the envelope return their payload directly. Detecting
  // the envelope rather than assuming it keeps both working.
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}
