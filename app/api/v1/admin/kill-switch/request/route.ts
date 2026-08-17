import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAdmin } from '@/lib/server/rbac';
import { dualControlStore, type ApprovalAction } from '@/lib/server/dual-control';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const ACTIONS: ApprovalAction[] = ['PAUSE_TRADING', 'RESUME_TRADING', 'PAUSE_LAUNCHPAD', 'RESUME_LAUNCHPAD'];
const requestSchema = z.object({
  action: z.enum(ACTIONS as [ApprovalAction, ...ApprovalAction[]]),
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/v1/admin/kill-switch/request — proposes a kill-switch action.
 * Does not flip anything by itself — requires a second, distinct admin to
 * approve via /kill-switch/approve. Admin-only.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(requestSchema, payload);

    const approval = dualControlStore.propose(data.action, admin.userId, data.reason);

    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_PROPOSED',
      entityType: 'approval_request',
      entityId: approval.id,
      changes: { action: data.action, reason: data.reason },
    });

    return jsonResponse({ approval }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to propose kill switch action', 500));
  }
}
