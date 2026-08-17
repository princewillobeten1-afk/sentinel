import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAdmin } from '@/lib/server/rbac';
import { serverStore } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/users — list every user. Admin-only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const users = await serverStore.listUsers();
    return jsonResponse({ users, count: users.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list users', 500));
  }
}
