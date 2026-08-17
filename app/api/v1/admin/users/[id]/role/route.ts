import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAdmin } from '@/lib/server/rbac';
import { serverStore } from '@/lib/server/store';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const roleSchema = z.object({ role: z.enum(['user', 'admin', 'analyst']) });

/** POST /api/v1/admin/users/:id/role — change a user's role. Admin-only. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);

    const payload = await parseJsonBody(request);
    const data = validateSchema(roleSchema, payload);

    const target = await serverStore.findUserById(params.id);
    if (!target) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    const previousRole = target.role;
    const updated = await serverStore.updateUserRole(params.id, data.role);

    recordAuditEvent({
      userId: admin.userId,
      action: 'ROLE_CHANGED',
      entityType: 'user',
      entityId: params.id,
      changes: { from: previousRole, to: data.role },
    });

    return jsonResponse({ user: updated });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to change role', 500));
  }
}
