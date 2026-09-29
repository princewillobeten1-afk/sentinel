import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { ApiError } from '@/lib/server/errors';

const CALLBACK_PATH = '/api/v1/auth/google/callback';
export const GOOGLE_STATE_COOKIE = 'sentinel_google_oauth';

export type GoogleFlow = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  linkUserId?: string;
  createdAt: number;
};

export function googleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  const signingSecret = process.env.AUTH_JWT_SECRET?.trim();
  if (!clientId || !clientSecret || !redirectUri || !signingSecret || !process.env.DATABASE_URL) {
    throw new ApiError('Google sign-in is not configured. Contact the site owner.', 503, 'GOOGLE_AUTH_NOT_CONFIGURED');
  }
  let url: URL;
  try { url = new URL(redirectUri); } catch { throw new ApiError('Google sign-in is not configured.', 503, 'GOOGLE_AUTH_NOT_CONFIGURED'); }
  if (url.pathname !== CALLBACK_PATH || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) {
    throw new ApiError('Google sign-in redirect is not configured.', 503, 'GOOGLE_AUTH_NOT_CONFIGURED');
  }
  return { clientId, clientSecret, redirectUri, signingSecret };
}

export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') ||
      /[\u0000-\u001f]/.test(value)) return '/ai';
  const url = new URL(value, 'https://sentinel.invalid');
  return url.origin === 'https://sentinel.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/ai';
}

export function newGoogleFlow(returnTo: string, linkUserId?: string): GoogleFlow {
  return {
    state: randomBytes(24).toString('base64url'),
    nonce: randomBytes(24).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    returnTo: safeReturnTo(returnTo), linkUserId,
    createdAt: Date.now(),
  };
}

export function sealGoogleFlow(flow: GoogleFlow, secret: string): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readGoogleFlow(value: string | undefined, state: string | null, secret: string): GoogleFlow {
  if (!value || !state || value.length > 4096) throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID');
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID');
  const expected = createHmac('sha256', secret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID'); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID');
  }
  let flow: GoogleFlow;
  try { flow = JSON.parse(Buffer.from(payload, 'base64url').toString()); }
  catch { throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID'); }
  if (flow.state !== state || !flow.nonce || !flow.verifier || !Number.isFinite(flow.createdAt) ||
      Date.now() - flow.createdAt > 600_000 || flow.createdAt > Date.now() + 30_000) {
    throw new ApiError('Google sign-in expired. Please try again.', 400, 'GOOGLE_STATE_INVALID');
  }
  return { ...flow, returnTo: safeReturnTo(flow.returnTo) };
}

export function googleAuthorizationUrl(flow: GoogleFlow, config: ReturnType<typeof googleOAuthConfig>): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const challenge = createHash('sha256').update(flow.verifier).digest('base64url');
  for (const [key, value] of Object.entries({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code',
    scope: 'openid email profile', state: flow.state, nonce: flow.nonce,
    code_challenge: challenge, code_challenge_method: 'S256',
  })) url.searchParams.set(key, value);
  return url.toString();
}

export async function verifyGoogleCode(code: string, flow: GoogleFlow, config: ReturnType<typeof googleOAuthConfig>) {
  const body = new URLSearchParams({
    code, client_id: config.clientId, client_secret: config.clientSecret,
    redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: flow.verifier,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(10_000), cache: 'no-store',
  });
  if (!response.ok) throw new ApiError('Google sign-in could not be completed. Please retry.', 502, 'GOOGLE_TOKEN_EXCHANGE_FAILED');
  const tokens = await response.json() as { id_token?: string };
  if (!tokens.id_token) throw new ApiError('Google did not return an identity token.', 502, 'GOOGLE_ID_TOKEN_MISSING');
  const ticket = await new OAuth2Client().verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  const identity = ticket.getPayload();
  if (!identity?.sub || !identity.email || identity.email_verified !== true || identity.nonce !== flow.nonce) {
    throw new ApiError('Google identity verification failed.', 401, 'GOOGLE_IDENTITY_INVALID');
  }
  return { subject: identity.sub, email: identity.email.toLowerCase(),
    name: identity.name?.slice(0, 100) || identity.email.split('@')[0], picture: identity.picture || null };
}

export function googleStateCookie(value: string, maxAge: number): string {
  return `${GOOGLE_STATE_COOKIE}=${encodeURIComponent(value)}; Path=/api/v1/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
