export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, emailSchema } from '@/lib/server/validation';
import { requireAuth } from '@/lib/server/auth';
import { authService } from '@/lib/auth/auth-service';
import { ApiError } from '@/lib/server/errors';

const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(changeEmailSchema, payload);

    const result = await authService.changeEmail(
      authUser.userId,
      data.newEmail,
      data.currentPassword
    );

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Email change request failed', 400));
  }
}
