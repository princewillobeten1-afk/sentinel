import { createAuthSession, requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { logger } from '@/lib/server/logger';
import { mfaStore } from '@/lib/server/mfa-store';
import { resolveGoogleAccount } from '@/lib/auth/google-account';
import { googleOAuthConfig, googleStateCookie, readGoogleFlow, verifyGoogleCode } from '@/lib/auth/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let response: Response;
  try {
    const config = googleOAuthConfig();
    if (url.origin !== new URL(config.redirectUri).origin) {
      throw new ApiError('Google sign-in origin mismatch.', 400, 'GOOGLE_ORIGIN_MISMATCH');
    }
    const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)sentinel_google_oauth=([^;]+)/)?.[1];
    const flow = readGoogleFlow(cookie ? decodeURIComponent(cookie) : undefined, url.searchParams.get('state'), config.signingSecret);
    if (url.searchParams.has('error')) throw new ApiError('Google sign-in was cancelled.', 400, 'GOOGLE_AUTH_CANCELLED');
    const code = url.searchParams.get('code');
    if (!code || code.length > 4096) throw new ApiError('Google did not return an authorization code.', 400, 'GOOGLE_CODE_MISSING');
    if (flow.linkUserId) {
      const current = await requireAuth(request);
      if (current.userId !== flow.linkUserId) throw new ApiError('The linking session changed. Please retry.', 401, 'GOOGLE_LINK_SESSION_CHANGED');
    }
    const identity = await verifyGoogleCode(code, flow, config);
    const account = await resolveGoogleAccount(identity, flow.linkUserId);
    if (mfaStore.isEnabled(account.userId)) {
      throw new ApiError('Additional verification is required. Sign in using your existing method.', 403, 'GOOGLE_MFA_REQUIRED');
    }
    const { token } = await createAuthSession({ userId: account.userId, email: account.email, role: account.role }, {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent'),
    });
    response = new Response(null, { status: 303, headers: { Location: new URL(flow.returnTo, url.origin).toString() } });
    response.headers.append('Set-Cookie', `sentinel_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'GOOGLE_AUTH_FAILED';
    logger.warn('[auth] Google sign-in failed', { code });
    const destination = new URL('/login', url.origin);
    destination.searchParams.set('google_error', code);
    response = new Response(null, { status: 303, headers: { Location: destination.toString() } });
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.append('Set-Cookie', googleStateCookie('', 0));
  return response;
}
