export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, emailSchema } from '@/lib/server/validation';
import { authService } from '@/lib/auth/auth-service';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { getClientIp } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(forgotPasswordSchema, payload);
    const ip = getClientIp(request);

    checkRateLimit(`forgot_pw_${ip || 'anon'}`, 5, 300000); // 5 per 5 mins

    const result = await authService.forgotPassword(data.email);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Password reset request failed', 400));
  }
}
