import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { googleAuthorizationUrl, googleOAuthConfig, googleStateCookie, newGoogleFlow, sealGoogleFlow } from '@/lib/auth/google-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const config = googleOAuthConfig();
    if (url.origin !== new URL(config.redirectUri).origin) {
      throw new ApiError('Google sign-in origin does not match the configured redirect.', 400, 'GOOGLE_ORIGIN_MISMATCH');
    }
    const linkUserId = url.searchParams.get('mode') === 'link' ? (await requireAuth(request)).userId : undefined;
    const flow = newGoogleFlow(url.searchParams.get('returnTo') || '/ai', linkUserId);
    const response = new Response(null, { status: 302, headers: {
      Location: googleAuthorizationUrl(flow, config), 'Cache-Control': 'no-store',
    } });
    response.headers.append('Set-Cookie', googleStateCookie(sealGoogleFlow(flow, config.signingSecret), 600));
    return response;
  } catch (error) {
    const code = error instanceof ApiError ? error.code : 'GOOGLE_AUTH_FAILED';
    const destination = new URL('/login', url.origin);
    destination.searchParams.set('google_error', code);
    return Response.redirect(destination, 303);
  }
}
