export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { sessionService } from '@/lib/auth/session-service';
import { auditService } from '@/lib/auth/audit-service';
import { ApiError } from '@/lib/server/errors';

export async function POST(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const count = await sessionService.revokeAllUserSessions(authUser.userId, {
      reason: 'User requested logout-all',
    });

    await auditService.logEvent('user.logout_all', {
      userId: authUser.userId,
      severity: 'INFO',
      entityType: 'user_sessions',
      metadata: { revokedCount: count },
    });

    const response = jsonResponse({
      success: true,
      message: `Revoked ${count} active sessions`,
      revokedCount: count,
    });

    // Clear session cookie
    response.headers.append(
      'Set-Cookie',
      'sentinel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );

    return response;
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Unauthorized', 401));
  }
}
