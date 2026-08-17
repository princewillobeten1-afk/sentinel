import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { requireAuthWithSession } from '@/lib/server/auth';
import { sessionStore } from '@/lib/server/session-store';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const revokeAllSchema = z.object({
  includeCurrent: z.boolean().optional().default(false),
});

/** POST /api/v1/auth/sessions/revoke-all — "log out of all devices." Sparing the caller's own session unless `includeCurrent` is set. */
export async function POST(request: Request) {
  try {
    const user = await requireAuthWithSession(request);
    const payload = await parseJsonBody(request);
    const data = validateSchema(revokeAllSchema, payload);

    const count = await sessionStore.revokeAllForUser(user.userId, {
      exceptSessionId: data.includeCurrent ? undefined : user.sessionId,
      reason: 'user_requested_revoke_all',
    });

    recordAuditEvent({
      userId: user.userId,
      action: 'SESSION_REVOKED_ALL',
      entityType: 'session',
      changes: { count, includeCurrent: data.includeCurrent },
    });

    return jsonResponse({ revokedCount: count });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to revoke sessions', 500));
  }
}
