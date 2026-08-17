import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAdmin } from '@/lib/server/rbac';
import { killSwitch } from '@/lib/server/kill-switch';
import { dualControlStore } from '@/lib/server/dual-control';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/kill-switch — current pause state for every scope, plus any pending approval requests. Admin-only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonResponse({
      states: killSwitch.getAllStates(),
      pendingApprovals: dualControlStore.listPending(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load kill switch state', 500));
  }
}
