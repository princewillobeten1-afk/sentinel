import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAdmin } from '@/lib/server/rbac';
import { dualControlStore } from '@/lib/server/dual-control';
import { killSwitch, type KillSwitchScope } from '@/lib/server/kill-switch';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const approveSchema = z.object({ requestId: z.string().min(1) });

const ACTION_EFFECTS: Record<string, { scope: KillSwitchScope; pause: boolean }> = {
  PAUSE_TRADING: { scope: 'TRADING', pause: true },
  RESUME_TRADING: { scope: 'TRADING', pause: false },
  PAUSE_LAUNCHPAD: { scope: 'LAUNCHPAD', pause: true },
  RESUME_LAUNCHPAD: { scope: 'LAUNCHPAD', pause: false },
};

/**
 * POST /api/v1/admin/kill-switch/approve — approves a pending request and
 * actually flips the kill switch. Throws if the approver is the same admin
 * who proposed it — that's the real substance of dual control, not theater.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(approveSchema, payload);

    let approval;
    try {
      approval = dualControlStore.approve(data.requestId, admin.userId);
    } catch (err) {
      throw new ApiError(err instanceof Error ? err.message : 'Approval failed', 409, 'APPROVAL_FAILED');
    }

    const effect = ACTION_EFFECTS[approval.action];
    if (effect.pause) {
      killSwitch.pause(effect.scope, { reason: approval.reason, triggeredBy: admin.userId, source: 'ADMIN' });
    } else {
      killSwitch.resume(effect.scope, { triggeredBy: admin.userId });
    }

    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_APPROVED',
      entityType: 'approval_request',
      entityId: approval.id,
      changes: { action: approval.action, requestedBy: approval.requestedBy },
    });
    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_TRIGGERED',
      entityType: 'kill_switch',
      entityId: effect.scope,
      changes: { action: approval.action, requestedBy: approval.requestedBy, approvedBy: admin.userId },
    });

    return jsonResponse({ approval, state: killSwitch.getState(effect.scope) });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to approve kill switch action', 500));
  }
}
