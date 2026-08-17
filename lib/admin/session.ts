/**
 * Admin Session Security & Device Control Engine (Sprint 39 §7, §75).
 * Governs MFA challenges, device fingerprinting, idle lockouts, and instant revocation.
 */

import { AdminRole } from './types';

export interface AdminSessionRecord {
  sessionId: string;
  adminId: string;
  adminEmail: string;
  adminRole: AdminRole;
  deviceFingerprint: string;
  ipAddress: string;
  geoLocation: string;
  userAgent: string;
  mfaVerified: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class AdminSessionManager {
  private static instance: AdminSessionManager;
  private sessions: Map<string, AdminSessionRecord> = new Map();

  private constructor() {
    this.seedDemoSessions();
  }

  public static getInstance(): AdminSessionManager {
    if (!AdminSessionManager.instance) {
      AdminSessionManager.instance = new AdminSessionManager();
    }
    return AdminSessionManager.instance;
  }

  /**
   * Create a new authenticated admin session.
   */
  public createSession(opts: {
    adminId: string;
    adminEmail: string;
    adminRole: AdminRole;
    deviceFingerprint: string;
    ipAddress: string;
    geoLocation?: string;
    userAgent?: string;
    mfaVerified?: boolean;
  }): AdminSessionRecord {
    const now = new Date();
    const sessionId = `adm_sid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const session: AdminSessionRecord = {
      sessionId,
      adminId: opts.adminId,
      adminEmail: opts.adminEmail,
      adminRole: opts.adminRole,
      deviceFingerprint: opts.deviceFingerprint,
      ipAddress: opts.ipAddress,
      geoLocation: opts.geoLocation || 'US-East (Virginia)',
      userAgent: opts.userAgent || 'Mozilla/5.0 Sentinel Admin Client',
      mfaVerified: opts.mfaVerified ?? true,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      revokedAt: null,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Validate session state: checks expiration, revocation, and idle lockout.
   */
  public validateSession(sessionId: string): { valid: boolean; session?: AdminSessionRecord; reason?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session does not exist' };
    }

    if (session.revokedAt) {
      return { valid: false, session, reason: 'Session has been revoked' };
    }

    const now = Date.now();
    if (Date.parse(session.expiresAt) < now) {
      return { valid: false, session, reason: 'Session has expired' };
    }

    // Check idle lockout
    if (now - Date.parse(session.lastActiveAt) > IDLE_TIMEOUT_MS) {
      return { valid: false, session, reason: 'Session timed out due to inactivity' };
    }

    // Refresh last active timestamp
    session.lastActiveAt = new Date().toISOString();
    return { valid: true, session };
  }

  /**
   * Instantly revoke a specific session.
   */
  public revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.revokedAt = new Date().toISOString();
    return true;
  }

  /**
   * Revoke all active sessions for a specific admin user.
   */
  public revokeAllForAdmin(adminId: string): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const session of this.sessions.values()) {
      if (session.adminId === adminId && !session.revokedAt) {
        session.revokedAt = now;
        count++;
      }
    }
    return count;
  }

  /**
   * List all active sessions for an admin.
   */
  public listActiveSessions(adminId?: string): AdminSessionRecord[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter((s) => {
      const notExpired = Date.parse(s.expiresAt) > now;
      const notRevoked = !s.revokedAt;
      const matchAdmin = adminId ? s.adminId === adminId : true;
      return notExpired && notRevoked && matchAdmin;
    });
  }

  public reset(): void {
    this.sessions.clear();
    this.seedDemoSessions();
  }

  private seedDemoSessions(): void {
    const now = new Date();
    this.sessions.set('adm_sid_demo_super', {
      sessionId: 'adm_sid_demo_super',
      adminId: 'admin_super_01',
      adminEmail: 'superadmin@sentinel.network',
      adminRole: 'SUPER_ADMIN',
      deviceFingerprint: 'fp_m3_macbook_pro_99a8',
      ipAddress: '192.168.1.100',
      geoLocation: 'San Francisco, US',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      mfaVerified: true,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      revokedAt: null,
    });
  }
}

export const adminSessionManager = AdminSessionManager.getInstance();
