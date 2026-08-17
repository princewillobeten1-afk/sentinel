import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { executionKillSwitch } from '@/lib/execution/kill-switch';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/execution/blocklist — list blocklisted tokens & contracts */
export async function GET() {
  try {
    const list = executionKillSwitch.getBlocklist();
    return jsonResponse({
      blocklist: list,
      count: list.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch execution blocklist', 500));
  }
}

/** POST /api/v1/admin/execution/blocklist — add target to execution blocklist */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetType, targetValue, reason, adminId = 'admin_security_lead', expiresAt } = body;

    if (!targetType || !targetValue || !reason) {
      throw new ApiError('Missing required parameters (targetType, targetValue, reason)', 400);
    }

    const item = executionKillSwitch.blockTarget(
      targetType,
      targetValue,
      reason,
      adminId,
      expiresAt
    );

    return jsonResponse({
      success: true,
      blockedItem: item,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to block execution target', 500));
  }
}

/** DELETE /api/v1/admin/execution/blocklist — remove target from blocklist */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      throw new ApiError('Missing blocklist entry ID', 400);
    }

    const removed = executionKillSwitch.unblockTarget(id);

    return jsonResponse({
      success: removed,
      id,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to unblock target', 500));
  }
}
