import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { sessionService } from '@/lib/auth/session-service';

describe('SessionService - Lifecycle & Revocation', () => {
  let userId: string;

  beforeEach(async () => {
    dbRepository.reset();
    const reg = await authService.register({
      email: 'session.tester@sentinel.market',
      password: 'SessionPassword123!',
    });
    userId = reg.user.id;
  });

  it('creates and validates a server-managed session', async () => {
    const { session, token } = await sessionService.createSession(userId, {
      ip: '192.168.1.50',
      userAgent: 'Firefox/Linux',
      expiresInSeconds: 3600,
    });

    expect(session.id.startsWith('sess_')).toBe(true);
    expect(session.userId).toBe(userId);
    expect(session.ipAddress).toBe('192.168.1.50');

    // Validate using session ID
    const valById = await sessionService.validateSession(session.id);
    expect(valById.isValid).toBe(true);
    expect(valById.user?.id).toBe(userId);

    // Validate using JWT token
    const valByToken = await sessionService.validateSession(token);
    expect(valByToken.isValid).toBe(true);
    expect(valByToken.session?.id).toBe(session.id);
  });

  it('updates last activity timestamp on session touch', async () => {
    const { session } = await sessionService.createSession(userId);
    const initialActivity = session.lastActivityAt;

    // Simulate delay
    await sessionService.touchSession(session.id);
    const updated = dbRepository.getSession(session.id);
    expect(updated).toBeDefined();
    expect(new Date(updated!.last_activity_at).getTime()).toBeGreaterThanOrEqual(
      new Date(initialActivity).getTime()
    );
  });

  it('rotates session, revoking the old session and generating a new valid session', async () => {
    const { session: oldSession } = await sessionService.createSession(userId, {
      ip: '10.0.0.1',
      userAgent: 'Desktop/App',
    });

    const { session: newSession, token: newToken } = await sessionService.rotateSession(oldSession.id);

    expect(newSession.id).not.toBe(oldSession.id);

    // Old session should be invalid & revoked
    const valOld = await sessionService.validateSession(oldSession.id);
    expect(valOld.isValid).toBe(false);
    expect(valOld.reason).toContain('revoked');

    // New session should be valid
    const valNew = await sessionService.validateSession(newToken);
    expect(valNew.isValid).toBe(true);
    expect(valNew.session?.id).toBe(newSession.id);
  });

  it('revokes a single session explicitly', async () => {
    const { session } = await sessionService.createSession(userId);

    const revoked = await sessionService.revokeSession(session.id, 'User clicked logout');
    expect(revoked).toBe(true);

    const val = await sessionService.validateSession(session.id);
    expect(val.isValid).toBe(false);
    expect(val.reason).toContain('revoked');
  });

  it('revokes all sessions for a user, optionally sparing the caller session', async () => {
    const s1 = await sessionService.createSession(userId);
    const s2 = await sessionService.createSession(userId);
    const s3 = await sessionService.createSession(userId);

    // Revoke all except s3
    const revokedCount = await sessionService.revokeAllUserSessions(userId, {
      exceptSessionId: s3.session.id,
      reason: 'User password changed',
    });

    expect(revokedCount).toBeGreaterThanOrEqual(2);
    expect((await sessionService.validateSession(s1.session.id)).isValid).toBe(false);
    expect((await sessionService.validateSession(s2.session.id)).isValid).toBe(false);
    expect((await sessionService.validateSession(s3.session.id)).isValid).toBe(true);
  });

  it('rejects expired sessions', async () => {
    const { session } = await sessionService.createSession(userId, {
      expiresInSeconds: -10, // Expired in the past
    });

    const val = await sessionService.validateSession(session.id);
    expect(val.isValid).toBe(false);
    expect(val.reason).toContain('expired');
  });
});
