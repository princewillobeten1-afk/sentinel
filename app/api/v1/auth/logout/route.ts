export const dynamic = 'force-dynamic';
import { jsonResponse } from '@/lib/server/api';
import { getBearerToken, verifyAuthTokenWithSession } from '@/lib/server/auth';
import { sessionStore } from '@/lib/server/session-store';
import { recordAuditEvent } from '@/lib/server/audit';

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (token) {
    const user = await verifyAuthTokenWithSession(token);
    if (user) {
      await sessionStore.revoke(user.sessionId, 'logout');
      recordAuditEvent({ userId: user.userId, action: 'LOGOUT', entityType: 'session', entityId: user.sessionId });
    }
  }

  const response = jsonResponse({ success: true, message: 'Logged out successfully' });

  // Clear session cookie
  response.headers.append(
    'Set-Cookie',
    'sentinel_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );

  return response;
}
