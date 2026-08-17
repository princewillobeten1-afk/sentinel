/**
 * API Gateway (Sprint 28 §4).
 *
 * The single shared wrapper every developer-facing route runs through:
 * credential resolution → scope check → rate limiting → idempotency →
 * handler → header/usage logging. Before this, all 126 `route.ts` files in
 * the app hand-rolled their own `try/catch` + `requireAuth` + response
 * shaping with no shared abstraction — this file is that abstraction, for
 * the new developer-facing surface (existing internal-only routes are not
 * retrofitted, see the sprint plan's explicit scope boundary).
 *
 * Two credential paths, resolved by prefix:
 *   sk_live_... / sk_sandbox_...  → API key (`apiKeyStore.verify`), scopes enforced
 *   anything else                 → existing session JWT/cookie (`requireAuth`),
 *                                    only when the route opts in via `allowSessionAuth`
 *
 * A session-authenticated call resolves to the same `AuthUser` shape
 * `requireAuth` already returns, so a rewired route's call into an existing
 * service (e.g. `getPortfolioForWallet({user, ...})`) needs no changes.
 */

import { ApiError } from './errors';
import { errorResponse } from './api';
import { generateId } from './id';
import { getBearerToken, requireAuth, type AuthUser } from './auth';
import { requireRole } from './rbac';
import { apiKeyStore, type ApiKey } from './api-keys';
import { hasRequiredScopes, missingScopes, type Scope } from './scopes';
import { checkRateLimitV2, getRateLimitHeaders } from './rate-limit-v2';
import { fingerprintRequest, withIdempotency } from './idempotency';
import { recordUsage } from './usage-log';
import { serverStore } from './store';

export interface GatewayContext {
  user: AuthUser;
  apiKey: ApiKey | null;
  scopes: Scope[];
  requestId: string;
}

export interface GatewayOptions {
  /** Scopes required when the caller authenticated via API key. Ignored for session auth. */
  scopes: Scope[];
  /** Allows the existing session JWT/cookie to authenticate this route (dashboard's own calls). */
  allowSessionAuth?: boolean;
  /** Marks this route as idempotency-capable; an `Idempotency-Key` header, if present, dedupes retries. */
  idempotent?: boolean;
  /**
   * Lets the request through with no credential at all, as an anonymous
   * caller — for routes the existing web app already fetches unauthenticated
   * from the browser (e.g. discovery: confirmed via `lib/hooks/use-discovery-feed.ts`,
   * a plain `fetch()` with no Authorization header). Requiring auth on those
   * would silently break the live UI, not just gate new developer traffic.
   * A presented API key is still fully verified/scoped/rate-limited/metered
   * when one IS sent; this only relaxes the "a credential must be present"
   * requirement, not scope enforcement once one exists.
   */
  optionalAuth?: boolean;
  /**
   * Restricts this route to accounts with one of these roles (Sprint 30 —
   * Tier 3), checked uniformly regardless of whether the caller authenticated
   * via API key or session — both paths resolve a real `DbUser.role`. Not
   * used by today's routes (admin routes call `requireAdmin` directly instead,
   * matching how other internal-only routes bypass the gateway entirely) —
   * here for a future developer-API admin surface that needs both scopes and
   * a role check together.
   */
  requiredRole?: AuthUser['role'][];
}

const ANONYMOUS_USER: AuthUser = { userId: 'anonymous', role: 'user' };

type RouteParams = Record<string, string>;
type GatewayHandler = (ctx: GatewayContext, request: Request, params: RouteParams) => Promise<Response>;

const API_KEY_PREFIX = /^sk_(live|sandbox)_/;

export function withApiGateway(handler: GatewayHandler, options: GatewayOptions) {
  return async function gatewayRoute(request: Request, routeContext: { params: RouteParams }): Promise<Response> {
    const requestId = generateId('req');
    const startedAt = Date.now();
    const params = routeContext?.params ?? {};
    const pathname = new URL(request.url).pathname;

    let response: Response;
    let userId = 'anonymous';
    let apiKeyId: string | null = null;
    // Local to this invocation, not module state — concurrent requests each
    // get their own closure over this variable, so there's no risk of one
    // request's rate-limit headers leaking onto another's response.
    let rateLimitHeaders: Record<string, string> | null = null;

    try {
      const resolved = await resolveCredential(request, options);
      userId = resolved.user.userId;
      apiKeyId = resolved.apiKey?.id ?? null;

      if (options.requiredRole) {
        requireRole(resolved.user, options.requiredRole);
      }

      if (resolved.apiKey) {
        enforceScopes(resolved.apiKey, options.scopes);
        rateLimitHeaders = applyRateLimit(resolved.apiKey, request);
      }

      const ctx: GatewayContext = {
        user: resolved.user,
        apiKey: resolved.apiKey,
        scopes: resolved.apiKey?.scopes ?? options.scopes,
        requestId,
      };

      response = options.idempotent
        ? await runIdempotent(ctx, request, params, handler)
        : await handler(ctx, request, params);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        rateLimitHeaders = error.rateLimitHeaders;
      }
      response = errorResponse(error instanceof Error ? error : new ApiError('Internal server error', 500));
    }

    response.headers.set('X-Request-Id', requestId);
    if (rateLimitHeaders) {
      for (const [key, value] of Object.entries(rateLimitHeaders)) response.headers.set(key, value);
    }

    recordUsage({
      requestId,
      apiKeyId,
      userId,
      route: pathname,
      method: request.method,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
      occurredAt: new Date().toISOString(),
    });

    return response;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Credential resolution
// ────────────────────────────────────────────────────────────────────────────

interface ResolvedCredential {
  user: AuthUser;
  apiKey: ApiKey | null;
}

async function resolveCredential(request: Request, options: GatewayOptions): Promise<ResolvedCredential> {
  const token = getBearerToken(request);

  if (token && API_KEY_PREFIX.test(token)) {
    const apiKey = apiKeyStore.verify(token);
    if (!apiKey) {
      throw new ApiError('Invalid, expired, or revoked API key.', 401, 'API_KEY_INVALID');
    }

    const dbUser = await serverStore.findUserById(apiKey.userId);
    if (!dbUser) {
      throw new ApiError('The account that owns this API key no longer exists.', 401, 'API_KEY_ORPHANED');
    }

    const wallets = await serverStore.getUserWallets(dbUser.id);
    const primaryWallet = wallets.find((wallet) => wallet.isPrimary) ?? wallets[0];

    const user: AuthUser = {
      userId: dbUser.id,
      email: dbUser.email ?? undefined,
      role: dbUser.role,
      displayName: dbUser.displayName,
      primaryWalletAddress: primaryWallet?.address,
    };

    return { user, apiKey };
  }

  if (options.allowSessionAuth) {
    try {
      const user = await requireAuth(request);
      return { user, apiKey: null };
    } catch (sessionError) {
      if (options.optionalAuth) {
        return { user: ANONYMOUS_USER, apiKey: null };
      }
      throw sessionError;
    }
  }

  if (options.optionalAuth) {
    return { user: ANONYMOUS_USER, apiKey: null };
  }

  throw new ApiError('This endpoint requires an API key (Authorization: Bearer sk_live_... or sk_sandbox_...).', 401, 'API_KEY_REQUIRED');
}

function enforceScopes(apiKey: ApiKey, required: Scope[]): void {
  if (hasRequiredScopes(apiKey.scopes, required)) return;

  throw new ApiError(
    `This API key is missing required permission(s): ${missingScopes(apiKey.scopes, required).join(', ')}.`,
    403,
    'INSUFFICIENT_SCOPE',
    { requiredScopes: required, grantedScopes: apiKey.scopes },
  );
}

/** Returns the computed rate-limit headers on success, or throws `RateLimitedError` (which carries the same headers) when the caller is over their limit. */
function applyRateLimit(apiKey: ApiKey, request: Request): Record<string, string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const result = checkRateLimitV2(apiKey.id, apiKey.tier, ip);
  const headers = getRateLimitHeaders(result);

  if (!result.allowed) {
    throw new RateLimitedError(headers);
  }

  return headers;
}

class RateLimitedError extends ApiError {
  constructor(headers: Record<string, string>) {
    super('Rate limit exceeded.', 429, 'RATE_LIMITED', { retryAfterSeconds: headers['Retry-After'] });
    this.rateLimitHeaders = headers;
  }
  rateLimitHeaders: Record<string, string>;
}

/**
 * Note: routing a response through the idempotency cache re-serializes it as
 * JSON, so any handler-specific custom headers beyond Content-Type are lost
 * (X-Request-Id and rate-limit headers are unaffected — those are applied by
 * the outer `gatewayRoute` after this returns). Acceptable for the write
 * endpoints this is used on today (orders, webhooks, launches), none of
 * which set custom headers; revisit if that changes.
 */
async function runIdempotent(ctx: GatewayContext, request: Request, params: RouteParams, handler: GatewayHandler): Promise<Response> {
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return handler(ctx, request, params);
  }

  const bodyText = await request.clone().text().catch(() => '');
  const fingerprint = fingerprintRequest(request.method, new URL(request.url).pathname, bodyText);

  const result = await withIdempotency(ctx.user.userId, idempotencyKey, fingerprint, async () => {
    const res = await handler(ctx, request, params);
    const bodyJson = await res.clone().json().catch(() => null);
    return { status: res.status, body: bodyJson, headers: {} };
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replayed': String(result.replayed) },
  });
}
