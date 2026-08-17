export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { authService } from '@/lib/auth/auth-service';
import { ApiError } from '@/lib/server/errors';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(verifyEmailSchema, payload);

    const result = await authService.verifyEmail(data.token);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Email verification failed', 400));
  }
}
