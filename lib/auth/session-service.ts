/**
 * Session Management Service (Sprint 43 §13-20, §75).
 *
 * Implements server-managed session lifecycle, activity tracking,
 * session rotation on security events, and revocation controls.
 */

import { dbRepository } from '../db/repository';
import { identityStore } from './identity-store';
import { sessionStore } from '../server/session-store';
import { createAuthToken, verifyAuthToken } from '../server/auth';
import { UserSession, User } from './types';
import { DbUserSession } from '../db/schema';

export class SessionService {
  private static instance: SessionService;
  private defaultSessionDurationSeconds = 86400 * 7; // 7 days

  private constructor() {}

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Creates a new server-managed session record and issues a signed JWT cookie payload.
   */
  public async createSession(
    userId: string,
    opts: {
      ip?: string | null;
      userAgent?: string | null;
      expiresInSeconds?: number;
    } = {}
  ): Promise<{ session: UserSession; token: string }> {
    const user = await identityStore.getUser(userId);
    if (!user) {
      throw new Error(`Cannot create session for non-existent user: ${userId}`);
    }

    if (user.status === 'suspended') {
      throw new Error('Cannot create session for suspended account');
    }

    const duration = opts.expiresInSeconds || this.defaultSessionDurationSeconds;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 1000).toISOString();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const dbSession: DbUserSession = {
      id: sessionId,
      user_id: userId,
      ip_address: opts.ip ?? null,
      user_agent: opts.userAgent ?? null,
      created_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      revoked_reason: null,
    };

    await identityStore.saveSession(dbSession);

    // Keep sessionStore in sync for legacy middleware integration. Fire-and-
    // forget: sessionStore is now Postgres-backed (Phase 1) and async, but
    // this method's own public API stays synchronous — a sync-failure here
    // must not block session creation on the dbRepository path above.
    sessionStore.create(userId, {
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      expiresInSeconds: duration,
      mfaVerified: false,
    }).catch(() => {});

    const token = createAuthToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        primaryWalletAddress: user.username,
        displayName: user.display_name,
      },
      sessionId,
      duration
    );

    const session = this.mapDbSessionToSession(dbSession);
    return { session, token };
  }

  /**
   * Validates a session by ID or JWT token.
   */
  public async validateSession(tokenOrSessionId: string): Promise<{
    isValid: boolean;
    session?: UserSession;
    user?: User;
    reason?: string;
  }> {
    let sid = tokenOrSessionId;

    if (tokenOrSessionId.includes('.')) {
      try {
        const parts = tokenOrSessionId.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
          const payload = JSON.parse(payloadJson);
          sid = payload.sid || payload.userId || tokenOrSessionId;
        }
      } catch (err: any) {
        return { isValid: false, reason: err.message || 'Invalid JWT token' };
      }
    }

    const dbSession = await identityStore.getSession(sid);
    if (!dbSession) {
      return { isValid: false, reason: 'Session not found on server' };
    }

    if (dbSession.revoked_at) {
      return { isValid: false, reason: `Session revoked: ${dbSession.revoked_reason || 'Manual revocation'}` };
    }

    if (new Date(dbSession.expires_at).getTime() < Date.now()) {
      return { isValid: false, reason: 'Session has expired' };
    }

    const dbUser = await identityStore.getUser(dbSession.user_id);
    if (!dbUser) {
      return { isValid: false, reason: 'User associated with session not found' };
    }

    if (dbUser.status === 'suspended') {
      return { isValid: false, reason: 'Account has been suspended' };
    }

    return {
      isValid: true,
      session: this.mapDbSessionToSession(dbSession),
      user: {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.display_name ?? '',
        avatarUrl: dbUser.avatar_url,
        emailVerifiedAt: dbUser.email_verified_at,
        status: dbUser.status,
        role: dbUser.role,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at,
        lastLoginAt: dbUser.last_login_at,
      },
    };
  }

  /**
   * Updates last_activity_at on active session to support sliding inactivity timeouts.
   */
  public async touchSession(sessionId: string): Promise<void> {
    const s = await identityStore.getSession(sessionId);
    if (s && !s.revoked_at) {
      s.last_activity_at = new Date().toISOString();
      await identityStore.saveSession(s);
      sessionStore.touch(sessionId).catch(() => {});
    }
  }

  /**
   * Rotates a session (revokes old session ID and mints a new one) on security privilege events.
   */
  public async rotateSession(
    oldSessionId: string,
    opts: { ip?: string | null; userAgent?: string | null } = {}
  ): Promise<{ session: UserSession; token: string }> {
    const existing = await identityStore.getSession(oldSessionId);
    if (!existing) {
      throw new Error(`Cannot rotate non-existent session: ${oldSessionId}`);
    }

    // Revoke old session
    this.revokeSession(oldSessionId, 'Rotated during security event');

    // Create fresh session
    return this.createSession(existing.user_id, {
      ip: opts.ip ?? existing.ip_address,
      userAgent: opts.userAgent ?? existing.user_agent,
    });
  }

  /**
   * Revokes a single session server-side.
   */
  public async revokeSession(sessionId: string, reason = 'User logout'): Promise<boolean> {
    sessionStore.revoke(sessionId, reason).catch(() => {});
    return await identityStore.revokeSession(sessionId, reason);
  }

  /**
   * Revokes all active sessions for a user (e.g. password change, security compromise).
   */
  public async revokeAllUserSessions(userId: string, opts: { exceptSessionId?: string; reason?: string } = {}): Promise<number> {
    sessionStore.revokeAllForUser(userId, {
      exceptSessionId: opts.exceptSessionId,
      reason: opts.reason || 'User requested logout-all',
    }).catch(() => {});
    return await identityStore.revokeAllUserSessions(userId, opts.exceptSessionId, opts.reason);
  }

  /**
   * Lists all sessions (active and revoked) for an authenticated user.
   */
  public async listUserSessions(userId: string): Promise<UserSession[]> {
    const list = await identityStore.getUserSessions(userId);
    return list.map((s) => this.mapDbSessionToSession(s));
  }

  private mapDbSessionToSession(db: DbUserSession): UserSession {
    return {
      id: db.id,
      userId: db.user_id,
      tokenHash: db.token_hash,
      ipAddress: db.ip_address ?? null,
      userAgent: db.user_agent ?? null,
      createdAt: db.created_at,
      lastActivityAt: db.last_activity_at,
      expiresAt: db.expires_at,
      revokedAt: db.revoked_at,
      revokedReason: db.revoked_reason,
    };
  }
}

export const sessionService = SessionService.getInstance();
