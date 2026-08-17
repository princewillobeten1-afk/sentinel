import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAdmin } from '@/lib/server/rbac';
import { dualControlStore } from '@/lib/server/dual-control';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const rejectSchema = z.object({ requestId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(rejectSchema, payload);

    let approval;
    try {
      approval = dualControlStore.reject(data.requestId, admin.userId);
    } catch (err) {
      throw new ApiError(err instanceof Error ? err.message : 'Rejection failed', 409, 'REJECTION_FAILED');
    }

    recordAuditEvent({
      userId: admin.userId,
      action: 'KILL_SWITCH_REJECTED',
      entityType: 'approval_request',
      entityId: approval.id,
      changes: { action: approval.action, requestedBy: approval.requestedBy },
    });

    return jsonResponse({ approval });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to reject kill switch action', 500));
  }
}
