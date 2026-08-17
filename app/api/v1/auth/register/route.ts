export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, emailSchema, passwordSchema } from '@/lib/server/validation';
import { authService } from '@/lib/auth/auth-service';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { getClientIp } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(2).max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(registerSchema, payload);
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent');

    checkRateLimit(`register_${ip || 'anon'}`, 10, 600000); // 10 per 10 mins

    const result = await authService.register({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      ip,
      userAgent,
    });

    const response = jsonResponse({
      user: result.user,
      session: result.session,
      token: result.token,
      emailVerificationToken: result.emailVerificationToken,
    }, 201);

    // Set secure session cookie
    response.headers.append(
      'Set-Cookie',
      `sentinel_session=${encodeURIComponent(result.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Registration failed', 500));
  }
}
