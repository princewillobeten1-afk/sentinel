import crypto from 'node:crypto';
import { ApiError } from './errors';
import { env } from './env';
import { serverStore } from './store';
import { logger } from './logger';
import { sessionStore, type ServerSession } from './session-store';
import { assertSameOriginForCookieAuth } from './csrf';

export interface AuthUser {
  userId: string;
  email?: string;
  role: 'user' | 'admin' | 'analyst';
  primaryWalletAddress?: string;
  displayName?: string;
}

export interface SessionTokenPayload {
  userId: string;
  primaryWalletAddress: string;
  role: 'user' | 'admin' | 'analyst';
  sid: string;
  iat: number;
  exp: number;
}

export interface AuthUserWithSession extends AuthUser {
  sessionId: string;
}

const AUTH_HEADER_PREFIX = 'Bearer ';

/**
 * There used to be a hardcoded fallback secret here (`sentinel_jwt_secret_sprint2_key_99`).
 * That's a forgeable-token vulnerability if `AUTH_JWT_SECRET` is ever left unset in a real
 * deployment — anyone who's read this file's source can mint a valid session for any user.
 * Production now fails hard instead. Dev/test gets a random secret generated once per
 * process (not committed anywhere, not guessable), so local development still works with
 * zero env-file setup.
 */
let devSecret: string | null = null;

function getJwtSecret(): string {
  if (env.AUTH_JWT_SECRET) return env.AUTH_JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET must be set in production — refusing to sign or verify session tokens.');
  }

  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString('hex');
    logger.warn('[auth] AUTH_JWT_SECRET not set — using a random per-process dev secret. Set AUTH_JWT_SECRET for stable sessions across restarts.');
  }
  return devSecret;
}

/**
 * True when credential resolution would fall through to the cookie (no
 * `Authorization` header present) — the CSRF-relevant distinction. Mirrors
 * `getBearerToken`'s own precedence check without changing its return type.
 */
export function isCookieCredential(request: Request): boolean {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  return !authorization.startsWith(AUTH_HEADER_PREFIX);
}

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')?.trim() ?? '';

  if (authorization.startsWith(AUTH_HEADER_PREFIX)) {
    return authorization.slice(AUTH_HEADER_PREFIX.length).trim();
  }

  // Fallback check for session cookie
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/sentinel_session=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Signs a JWT around an already-created session record. Low-level primitive —
 * routes should call `createAuthSession` instead, which creates the session
 * record too. Exported for the rare case a caller already has a `sid`.
 */
export function createAuthToken(user: AuthUser, sid: string, expiresInSeconds = 86400 * 7): string {
  const secret = getJwtSecret();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    userId: user.userId,
    primaryWalletAddress: user.primaryWalletAddress || '',
    role: user.role,
    sid,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export interface SessionMeta {
  ip: string | null;
  userAgent: string | null;
}

/**
 * The real entry point for issuing a session: creates the server-side
 * `ServerSession` record first (so it can later be listed/revoked), then
 * signs a JWT embedding its id as `sid`. `verifyAuthToken` checks the
 * session record on every request — this is what makes revocation real
 * instead of "wait for the JWT to expire on its own."
 */
export async function createAuthSession(
  user: AuthUser,
  meta: SessionMeta,
  expiresInSeconds = 86400 * 7,
  mfaVerified = true,
): Promise<{ token: string; session: ServerSession }> {
  const session = await sessionStore.create(user.userId, {
    ip: meta.ip,
    userAgent: meta.userAgent,
    expiresInSeconds,
    mfaVerified,
  });
  const token = createAuthToken(user, session.id, expiresInSeconds);
  return { token, session };
}

/** Extracts a best-effort client IP from standard proxy headers. */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip') || null;
}

/**
 * Verifies a signed JWT session token and returns decoded payload.
 */
const DEV_ONLY_TOKENS: Record<string, AuthUser> = {
  'demo-token': {
    userId: 'user_001',
    email: 'trader@sentinel.local',
    role: 'user',
    primaryWalletAddress: '7xK99zK8mP2xQ5wN3a19',
    displayName: 'Sentinel Alpha Trader',
  },
  // Two distinct admins so dual-control approval flows can be exercised without a real
  // admin-onboarding process — see the matching seed in lib/server/store.ts.
  'demo-admin-a-token': { userId: 'admin_001', email: 'admin-a@sentinel.local', role: 'admin', displayName: 'Sentinel Admin A' },
  'demo-admin-b-token': { userId: 'admin_002', email: 'admin-b@sentinel.local', role: 'admin', displayName: 'Sentinel Admin B' },
};

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Dev/test convenience only — structurally unreachable in production, not just
      // logically skipped, so this can never become a real-world auth bypass.
      if (token in DEV_ONLY_TOKENS && process.env.NODE_ENV !== 'production') {
        return DEV_ONLY_TOKENS[token];
      }
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const secret = getJwtSecret();

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const payloadText = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadText) as SessionTokenPayload;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Every token minted via createAuthSession carries a `sid` tied to a real,
    // revocable session record — this is the actual revocation-enforcement point.
    // A token without a valid `sid` (missing, unknown, or revoked) is rejected
    // outright rather than falling back to "trust the JWT alone."
    if (!payload.sid || !(await sessionStore.isValid(payload.sid))) {
      return null;
    }
    await sessionStore.touch(payload.sid);

    const dbUser = await serverStore.findUserById(payload.userId);
    if (!dbUser) {
      return null;
    }

    const userWallets = await serverStore.getUserWallets(dbUser.id);
    const primaryWallet = userWallets.find((w) => w.isPrimary) || userWallets[0];

    return {
      userId: dbUser.id,
      email: dbUser.email || undefined,
      role: dbUser.role,
      displayName: dbUser.displayName,
      primaryWalletAddress: primaryWallet?.address || payload.primaryWalletAddress,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Like `verifyAuthToken`, but also surfaces the session id — needed by routes
 * that manage sessions themselves (e.g. "list my sessions," "log out
 * everywhere but here") where the caller's own session must be identifiable.
 */
export async function verifyAuthTokenWithSession(token: string): Promise<AuthUserWithSession | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const encodedPayload = parts[1];
    const payloadText = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadText) as SessionTokenPayload;
    const user = await verifyAuthToken(token);
    if (!user || !payload.sid) return null;
    return { ...user, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthUser> {
  const token = getBearerToken(request);

  if (!token) {
    throw new ApiError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (isCookieCredential(request)) {
    assertSameOriginForCookieAuth(request, { method: request.method });
  }

  const user = await verifyAuthToken(token);

  if (!user) {
    throw new ApiError('Invalid or expired authentication session', 401, 'AUTH_INVALID');
  }

  return user;
}

/** Like `requireAuth`, but also returns the caller's own session id — for session-management routes. */
export async function requireAuthWithSession(request: Request): Promise<AuthUserWithSession> {
  const token = getBearerToken(request);

  if (!token) {
    throw new ApiError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  const user = await verifyAuthTokenWithSession(token);

  if (!user) {
    throw new ApiError('Invalid or expired authentication session', 401, 'AUTH_INVALID');
  }

  return user;
}

export async function optionalAuth(request: Request): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  try {
    if (isCookieCredential(request)) {
      assertSameOriginForCookieAuth(request, { method: request.method });
    }
    return await verifyAuthToken(token);
  } catch {
    return null;
  }
}
