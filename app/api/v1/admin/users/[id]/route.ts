import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAdmin } from '@/lib/server/rbac';
import { serverStore } from '@/lib/server/store';
import { sessionStore } from '@/lib/server/session-store';
import { mfaStore } from '@/lib/server/mfa-store';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/users/:id — a user's wallets, active sessions, and MFA status. Admin-only. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request);

    const user = await serverStore.findUserById(params.id);
    if (!user) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    return jsonResponse({
      user,
      wallets: await serverStore.getUserWallets(user.id),
      sessions: await sessionStore.listForUser(user.id),
      mfaEnabled: mfaStore.isEnabled(user.id),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load user', 500));
  }
}
