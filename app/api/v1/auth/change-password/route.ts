export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema, passwordSchema } from '@/lib/server/validation';
import { requireAuthWithSession } from '@/lib/server/auth';
import { authService } from '@/lib/auth/auth-service';
import { ApiError } from '@/lib/server/errors';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthWithSession(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(changePasswordSchema, payload);

    const result = await authService.changePassword(
      authUser.userId,
      data.currentPassword,
      data.newPassword,
      authUser.sessionId
    );

    return jsonResponse({ success: true, message: 'Password successfully changed' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Password change failed', 400));
  }
}
