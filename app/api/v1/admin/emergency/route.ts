import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminEmergencyEngine } from '@/lib/admin/emergency';
import { TradingEmergencyMode } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/emergency — current emergency state and kill switches. */
export async function GET() {
  try {
    return jsonResponse(adminEmergencyEngine.getState());
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch emergency state', 500));
  }
}

/** POST /api/v1/admin/emergency — mutate emergency state or toggle kill switches. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, mode, switchKey, value, updatedBy = 'admin_duty', updatedByRole = 'SUPER_ADMIN', reason = 'Manual switchboard update' } = body;

    if (action === 'SET_MODE' && mode) {
      const newState = adminEmergencyEngine.setEmergencyMode({
        mode: mode as TradingEmergencyMode,
        updatedBy,
        updatedByRole,
        reason,
      });
      return jsonResponse(newState);
    }

    if (action === 'TOGGLE_SWITCH' && switchKey) {
      const newState = adminEmergencyEngine.setKillSwitch(switchKey, value, {
        updatedBy,
        updatedByRole,
        reason,
      });
      return jsonResponse(newState);
    }

    return jsonResponse(adminEmergencyEngine.getState());
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update emergency state', 500));
  }
}
