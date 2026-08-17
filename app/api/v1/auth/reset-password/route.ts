export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, passwordSchema } from '@/lib/server/validation';
import { authService } from '@/lib/auth/auth-service';
import { ApiError } from '@/lib/server/errors';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(resetPasswordSchema, payload);

    const result = await authService.resetPassword(data.token, data.newPassword);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Password reset failed', 400));
  }
}
