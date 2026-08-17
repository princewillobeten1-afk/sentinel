import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { sessionStore } from '@/lib/server/session-store';
import { sessionService } from '@/lib/auth/session-service';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

/** DELETE /api/v1/auth/sessions/:id — revoke one of the caller's own sessions. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const session = await sessionStore.get(params.id);

    if (!session || session.userId !== user.userId) {
      throw new ApiError('Session not found', 404, 'SESSION_NOT_FOUND');
    }

    const revoked = await sessionStore.revoke(params.id, 'user_requested');
    await sessionService.revokeSession(params.id, 'user_requested');
    if (revoked) {
      recordAuditEvent({
        userId: user.userId,
        action: 'SESSION_REVOKED',
        entityType: 'session',
        entityId: params.id,
      });
    }

    return jsonResponse({ revoked, id: params.id });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to revoke session', 500));
  }
}
