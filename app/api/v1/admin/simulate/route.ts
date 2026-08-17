import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { AdminActionSimulator } from '@/lib/admin/simulator';

export const dynamic = 'force-dynamic';

/** POST /api/v1/admin/simulate — simulate administrative action and forecast financial/operational impact. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { actionType, currentFeePct, proposedFeePct, currentMode, proposedMode, thresholdName, currentValue, proposedValue } = body;

    if (actionType === 'FEE_RATE_CHANGE') {
      const result = AdminActionSimulator.simulateFeeChange({
        currentFeePct: currentFeePct ?? 0.5,
        proposedFeePct: proposedFeePct ?? 0.35,
      });
      return jsonResponse({ simulation: result });
    }

    if (actionType === 'EMERGENCY_MODE_CHANGE') {
      const result = AdminActionSimulator.simulateEmergencyEscalation({
        currentMode: currentMode || 'NORMAL',
        proposedMode: proposedMode || 'TRADING_RESTRICTED',
      });
      return jsonResponse({ simulation: result });
    }

    if (actionType === 'RISK_THRESHOLD_CHANGE') {
      const result = AdminActionSimulator.simulateRiskThresholdChange({
        thresholdName: thresholdName || 'insider_risk_threshold_score',
        currentValue: currentValue ?? 75,
        proposedValue: proposedValue ?? 60,
      });
      return jsonResponse({ simulation: result });
    }

    throw new ApiError('Unsupported simulation actionType', 400);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Action simulation failed', 500));
  }
}
