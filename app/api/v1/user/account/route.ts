import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { serverStore } from '@/lib/server/store';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const deleteAccountSchema = z.object({
  confirmDelete: z.boolean().refine((val) => val === true, {
    message: 'Explicit confirmation (confirmDelete: true) is required to close account.',
  }),
  reason: z.string().optional(),
});

export async function DELETE(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(deleteAccountSchema, payload);

    const user = await serverStore.findUserById(authUser.userId);
    if (!user) {
      throw new ApiError('User account not found', 404, 'USER_NOT_FOUND');
    }

    // Soft-deletion / Controlled deactivation: mark status as 'closed'
    await serverStore.updateUserStatus(authUser.userId, 'closed');

    const response = jsonResponse({
      success: true,
      message: 'Sentinel user account deactivated and closed. Historical blockchain records preserved for compliance.',
    });

    // Clear session cookie
    response.headers.append(
      'Set-Cookie',
      'sentinel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to process account deletion', 500));
  }
}
