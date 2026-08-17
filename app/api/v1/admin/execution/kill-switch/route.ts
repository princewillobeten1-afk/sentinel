import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { executionKillSwitch } from '@/lib/execution/kill-switch';

export const dynamic = 'force-dynamic';

/** POST /api/v1/admin/execution/kill-switch — admin emergency toggle for swap execution */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, reason = 'Administrative circuit breaker triggered', adminId = 'admin_security_lead' } = body;

    if (action === 'ENABLE') {
      executionKillSwitch.enableKillSwitch(reason, adminId);
      return jsonResponse({
        success: true,
        message: 'Swap execution emergency kill switch activated.',
        status: executionKillSwitch.getStatus(),
      });
    } else if (action === 'DISABLE') {
      executionKillSwitch.disableKillSwitch(adminId);
      return jsonResponse({
        success: true,
        message: 'Swap execution kill switch deactivated. Normal execution restored.',
        status: executionKillSwitch.getStatus(),
      });
    }

    return jsonResponse({
      status: executionKillSwitch.getStatus(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to toggle execution kill switch', 500));
  }
}
