export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, emailSchema, passwordSchema } from '@/lib/server/validation';
import { authService } from '@/lib/auth/auth-service';
import { getClientIp, AuthUser, createAuthSession } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { mfaStore } from '@/lib/server/mfa-store';
import { mfaChallengeStore } from '@/lib/server/mfa-challenge-store';

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(loginSchema, payload);
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');

    checkRateLimit(`login_${data.email.toLowerCase()}`, 10, 60000);

    // If demo fallback in dev/test
    if (data.email === 'demo@sentinel.local' && data.password === 'password123') {
      const demoUser: AuthUser = {
        userId: 'user_001',
        email: data.email,
        role: 'user',
      };

      if (mfaStore.isEnabled(demoUser.userId)) {
        const challenge = mfaChallengeStore.create(demoUser);
        return jsonResponse({ mfaRequired: true, mfaChallengeToken: challenge.id });
      }

      const { token, session } = await createAuthSession(demoUser, { ip, userAgent });
      const response = jsonResponse({
        token,
        session,
        user: {
          id: demoUser.userId,
          email: demoUser.email,
          displayName: 'Demo Trader',
          role: demoUser.role,
          status: 'active',
        },
      });

      response.headers.append(
        'Set-Cookie',
        `sentinel_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      );
      return response;
    }

    const result = await authService.login({
      email: data.email,
      password: data.password,
      ip,
      userAgent,
    });

    if (mfaStore.isEnabled(result.user.id)) {
      const challenge = mfaChallengeStore.create({
        userId: result.user.id,
        email: result.user.email || undefined,
        role: result.user.role,
      });
      return jsonResponse({ mfaRequired: true, mfaChallengeToken: challenge.id });
    }

    const response = jsonResponse({
      user: result.user,
      session: result.session,
      token: result.token,
    });

    response.headers.append(
      'Set-Cookie',
      `sentinel_session=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Request processing failed', 500));
  }
}
