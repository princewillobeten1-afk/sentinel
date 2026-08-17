/**
 * CSRF protection for the cookie-authenticated path only (Sprint 30 — Tier 6).
 *
 * The API-key Bearer-token path and the `Authorization: Bearer <jwt>` path
 * aren't CSRF-vulnerable by nature — a cross-site page can't attach a custom
 * header to a request without JS access to the token, which it doesn't
 * have. The `sentinel_session` cookie fallback is different: a browser
 * attaches cookies automatically, including to a request forged by a
 * malicious page. Origin/Referer checking was chosen over double-submit-
 * cookie because this app's cookie usage is exclusively same-origin (its own
 * frontend calling its own API) — no legitimate cross-origin caller relies
 * on the cookie, so there's nothing to preserve by allowing a mismatch, and
 * it requires zero frontend changes (no new cookie/header the client needs
 * to start sending).
 */

import { ApiError } from './errors';

export interface CsrfCheckOptions {
  /** Skip the check for safe (read-only) methods — GET/HEAD/OPTIONS never mutate state. */
  method: string;
}

/**
 * Pure Origin (falling back to Referer) vs. Host comparison — no `Request`
 * dependency, so it's reusable from both the REST cookie-auth path
 * (`assertSameOriginForCookieAuth` below) and the WS upgrade path
 * (`lib/ws/server.ts`'s `authenticateUpgrade`), which gets a raw
 * `IncomingMessage`, not a Fetch `Request`.
 */
export function originMatchesHost(originHeader: string | null, refererHeader: string | null, host: string): boolean {
  const candidate = originHeader ?? refererOrigin(refererHeader);
  if (!candidate) return false;

  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

/**
 * Throws `403 CSRF_ORIGIN_MISMATCH` if a state-changing request's Origin (or,
 * failing that, Referer) doesn't match the request's own Host — call this
 * only on the branch where credential resolution used the cookie, not a
 * Bearer header (see `lib/server/auth.ts#getBearerToken`'s two paths).
 */
export function assertSameOriginForCookieAuth(request: Request, options: CsrfCheckOptions): void {
  const method = options.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const host = request.headers.get('host');
  if (!host) {
    // No Host header at all is unusual enough to fail closed rather than skip the check.
    throw new ApiError('Request rejected: missing Host header.', 403, 'CSRF_ORIGIN_MISMATCH');
  }

  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');

  if (!originHeader && !refererHeader) {
    // Modern browsers always send Origin on same-origin AND cross-origin fetch/XHR for
    // non-GET requests — a legitimate same-origin call from this app's own frontend has
    // one. Its absence here is itself suspicious, not just inconclusive.
    throw new ApiError('Request rejected: missing Origin header on a cookie-authenticated mutation.', 403, 'CSRF_ORIGIN_MISMATCH');
  }

  if (!originMatchesHost(originHeader, refererHeader, host)) {
    throw new ApiError('Request rejected: Origin does not match this host.', 403, 'CSRF_ORIGIN_MISMATCH');
  }
}

function refererOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}
