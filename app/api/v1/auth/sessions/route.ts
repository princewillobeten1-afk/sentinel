import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuthWithSession } from '@/lib/server/auth';
import { sessionStore } from '@/lib/server/session-store';

export const dynamic = 'force-dynamic';

/** GET /api/v1/auth/sessions — list every active session for the caller, marking which one is the current request. */
export async function GET(request: Request) {
  try {
    const user = await requireAuthWithSession(request);
    const rawSessions = await sessionStore.listForUser(user.userId);
    const sessions = rawSessions.map((session) => ({
      ...session,
      isCurrent: session.id === user.sessionId,
    }));
    return jsonResponse({ sessions, count: sessions.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to list sessions', 500));
  }
}
