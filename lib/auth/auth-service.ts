/**
 * Authentication & Identity Service (Sprint 43 §4-12, §73).
 *
 * Implements user registration, credential authentication, password management,
 * email verification, account deactivation, and security audit tracking.
 */

import { dbRepository } from '../db/repository';
import { identityStore } from './identity-store';
import { cryptoService } from './crypto-service';
import { sessionService } from './session-service';
import { auditService } from './audit-service';
import { User, UserSession } from './types';
import { DbUser, DbPasswordResetToken, DbEmailVerificationToken } from '../db/schema';
import { ApiError } from '../server/errors';

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Registers a new user account with email and password.
   */
  public async register(input: {
    email: string;
    password: string;
    displayName?: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<{ user: User; session: UserSession; token: string; emailVerificationToken?: string }> {
    const email = input.email.toLowerCase().trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError('Valid email address is required', 400, 'INVALID_EMAIL');
    }

    if (!input.password || input.password.length < 8) {
      throw new ApiError('Password must be at least 8 characters long', 400, 'PASSWORD_TOO_SHORT');
    }

    const existingUser = await identityStore.getUserByEmail(email);
    if (existingUser) {
      throw new ApiError('An account with this email already exists', 409, 'EMAIL_ALREADY_REGISTERED');
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const passwordHash = cryptoService.hashPassword(input.password);
    const now = new Date().toISOString();
    const displayName = input.displayName?.trim() || email.split('@')[0] || 'Trader';

    const dbUser: DbUser = {
      id: userId,
      email,
      // Display name belongs in `display_name`, not `username`: `users.username`
      // carries a UNIQUE constraint (migration 013), so storing a display name
      // there made two users sharing a display name a hard database error. The
      // in-memory Map never enforced uniqueness, so this only surfaced once the
      // real Postgres backend landed (Phase 2).
      display_name: displayName,
      password_hash: passwordHash,
      status: 'active',
      role: 'user',
      created_at: now,
      updated_at: now,
      last_login_at: now,
    };

    await identityStore.saveUser(dbUser);

    // Create verification token
    const rawVerificationToken = cryptoService.generateSecureToken(32);
    const tokenHash = cryptoService.hashToken(rawVerificationToken);
    const tokenExpiresAt = new Date(Date.now() + 86400 * 1000).toISOString(); // 24 hours

    const dbToken: DbEmailVerificationToken = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      token_hash: tokenHash,
      new_email: email,
      expires_at: tokenExpiresAt,
      used_at: null,
      created_at: now,
    };
    await identityStore.saveEmailVerificationToken(dbToken);

    // Issue initial session
    const { session, token } = await sessionService.createSession(userId, {
      ip: input.ip,
      userAgent: input.userAgent,
    });

    await auditService.logEvent('user.registered', {
      userId,
      severity: 'INFO',
      entityType: 'user',
      entityId: userId,
      metadata: { email, displayName },
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.display_name || dbUser.username || 'Trader',
      avatarUrl: dbUser.avatar_url,
      emailVerifiedAt: dbUser.email_verified_at,
      status: dbUser.status,
      role: dbUser.role,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastLoginAt: dbUser.last_login_at,
    };

    return { user, session, token, emailVerificationToken: rawVerificationToken };
  }

  /**
   * Authenticates a user with email and password, issuing a new session.
   */
  public async login(input: {
    email: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<{ user: User; session: UserSession; token: string }> {
    const email = input.email.toLowerCase().trim();
    const dbUser = await identityStore.getUserByEmail(email);

    if (!dbUser || !dbUser.password_hash) {
      await auditService.logEvent('user.login_failed', {
        severity: 'WARNING',
        entityType: 'auth',
        metadata: { email, reason: 'USER_NOT_FOUND_OR_NO_PASSWORD' },
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });
      throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (dbUser.status === 'suspended') {
      await auditService.logEvent('user.login_blocked_suspended', {
        userId: dbUser.id,
        severity: 'CRITICAL',
        entityType: 'auth',
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });
      throw new ApiError('Account has been suspended. Please contact security support.', 403, 'ACCOUNT_SUSPENDED');
    }

    const isValidPassword = cryptoService.verifyPassword(input.password, dbUser.password_hash);
    if (!isValidPassword) {
      await auditService.logEvent('user.login_failed', {
        userId: dbUser.id,
        severity: 'WARNING',
        entityType: 'auth',
        metadata: { email, reason: 'BAD_PASSWORD' },
        ipAddress: input.ip,
        userAgent: input.userAgent,
      });
      throw new ApiError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last_login_at
    const now = new Date().toISOString();
    dbUser.last_login_at = now;
    await identityStore.saveUser(dbUser);

    const { session, token } = await sessionService.createSession(dbUser.id, {
      ip: input.ip,
      userAgent: input.userAgent,
    });

    await auditService.logEvent('user.login', {
      userId: dbUser.id,
      severity: 'INFO',
      entityType: 'auth',
      entityId: session.id,
      metadata: { email: dbUser.email },
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.display_name || dbUser.username || 'Trader',
      avatarUrl: dbUser.avatar_url,
      emailVerifiedAt: dbUser.email_verified_at,
      status: dbUser.status,
      role: dbUser.role,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at,
      lastLoginAt: dbUser.last_login_at,
    };

    return { user, session, token };
  }

  /**
   * Confirms email verification via one-time token.
   */
  public async verifyEmail(rawToken: string): Promise<{ success: boolean; message: string }> {
    if (!rawToken) {
      throw new ApiError('Verification token is required', 400, 'INVALID_TOKEN');
    }

    const tokenHash = cryptoService.hashToken(rawToken);
    const tokenRecord = await identityStore.getEmailVerificationTokenByHash(tokenHash);

    if (!tokenRecord) {
      throw new ApiError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
    }

    if (tokenRecord.used_at) {
      throw new ApiError('This verification token has already been used', 400, 'TOKEN_ALREADY_USED');
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      throw new ApiError('Verification token has expired', 400, 'TOKEN_EXPIRED');
    }

    const dbUser = await identityStore.getUser(tokenRecord.user_id);
    if (!dbUser) {
      throw new ApiError('User account not found', 404, 'USER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    tokenRecord.used_at = now;
    await identityStore.saveEmailVerificationToken(tokenRecord);

    dbUser.email_verified_at = now;
    if (tokenRecord.new_email) {
      dbUser.email = tokenRecord.new_email;
    }
    dbUser.updated_at = now;
    await identityStore.saveUser(dbUser);

    await auditService.logEvent('email.verified', {
      userId: dbUser.id,
      severity: 'INFO',
      entityType: 'user',
      entityId: dbUser.id,
      metadata: { email: dbUser.email },
    });

    return { success: true, message: 'Email successfully verified' };
  }

  /**
   * Requests a password reset link (account enumeration safe).
   */
  public async forgotPassword(email: string): Promise<{ message: string; rawTokenForTest?: string }> {
    const cleanEmail = email?.toLowerCase().trim();
    if (!cleanEmail) {
      return { message: 'If an account matches that email, a password reset link has been dispatched.' };
    }

    const dbUser = await identityStore.getUserByEmail(cleanEmail);
    if (!dbUser) {
      // Return generic message to prevent account enumeration
      return { message: 'If an account matches that email, a password reset link has been dispatched.' };
    }

    const rawToken = cryptoService.generateSecureToken(32);
    const tokenHash = cryptoService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

    const resetRecord: DbPasswordResetToken = {
      id: `prt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: dbUser.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date().toISOString(),
    };

    await identityStore.savePasswordResetToken(resetRecord);

    await auditService.logEvent('password.reset_requested', {
      userId: dbUser.id,
      severity: 'INFO',
      entityType: 'user',
      entityId: dbUser.id,
      metadata: { email: dbUser.email },
    });

    return {
      message: 'If an account matches that email, a password reset link has been dispatched.',
      rawTokenForTest: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  /**
   * Resets a user password using a single-use token and revokes active sessions.
   */
  public async resetPassword(rawToken: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!rawToken) {
      throw new ApiError('Reset token is required', 400, 'INVALID_TOKEN');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new ApiError('New password must be at least 8 characters long', 400, 'PASSWORD_TOO_SHORT');
    }

    const tokenHash = cryptoService.hashToken(rawToken);
    const tokenRecord = await identityStore.getPasswordResetTokenByHash(tokenHash);

    if (!tokenRecord) {
      throw new ApiError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }

    if (tokenRecord.used_at) {
      throw new ApiError('This reset token has already been used', 400, 'TOKEN_ALREADY_USED');
    }

    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      throw new ApiError('Reset token has expired', 400, 'TOKEN_EXPIRED');
    }

    const dbUser = await identityStore.getUser(tokenRecord.user_id);
    if (!dbUser) {
      throw new ApiError('User account not found', 404, 'USER_NOT_FOUND');
    }

    const now = new Date().toISOString();
    tokenRecord.used_at = now;
    await identityStore.savePasswordResetToken(tokenRecord);

    dbUser.password_hash = cryptoService.hashPassword(newPassword);
    dbUser.updated_at = now;
    await identityStore.saveUser(dbUser);

    // Invalidate all existing sessions on password reset
    await sessionService.revokeAllUserSessions(dbUser.id, { reason: 'Password reset completed' });

    await auditService.logEvent('password.reset_completed', {
      userId: dbUser.id,
      severity: 'INFO',
      entityType: 'user',
      entityId: dbUser.id,
    });

    return { success: true, message: 'Password has been successfully updated. Please log in.' };
  }

  /**
   * Changes an authenticated user's password with current password verification.
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string
  ): Promise<{ success: boolean }> {
    const dbUser = await identityStore.getUser(userId);
    if (!dbUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!dbUser.password_hash) {
      throw new ApiError('Account does not have a password set (wallet-authenticated)', 400, 'NO_PASSWORD_SET');
    }

    if (!cryptoService.verifyPassword(currentPassword, dbUser.password_hash)) {
      await auditService.logEvent('password.change_failed', {
        userId,
        severity: 'WARNING',
        entityType: 'user',
        metadata: { reason: 'BAD_CURRENT_PASSWORD' },
      });
      throw new ApiError('Current password does not match', 400, 'INVALID_CURRENT_PASSWORD');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new ApiError('New password must be at least 8 characters long', 400, 'PASSWORD_TOO_SHORT');
    }

    const now = new Date().toISOString();
    dbUser.password_hash = cryptoService.hashPassword(newPassword);
    dbUser.updated_at = now;
    await identityStore.saveUser(dbUser);

    // Revoke other sessions while preserving current session if provided
    await sessionService.revokeAllUserSessions(userId, {
      exceptSessionId: currentSessionId,
      reason: 'Password changed by user',
    });

    await auditService.logEvent('password.changed', {
      userId,
      severity: 'INFO',
      entityType: 'user',
      entityId: userId,
    });

    return { success: true };
  }

  /**
   * Requests an email change, creating a verification token for the new address.
   */
  public async changeEmail(
    userId: string,
    newEmail: string,
    currentPassword?: string
  ): Promise<{ success: boolean; verificationToken?: string }> {
    const dbUser = await identityStore.getUser(userId);
    if (!dbUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    const cleanEmail = newEmail.toLowerCase().trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new ApiError('Valid email address is required', 400, 'INVALID_EMAIL');
    }

    if (dbUser.password_hash && currentPassword) {
      if (!cryptoService.verifyPassword(currentPassword, dbUser.password_hash)) {
        throw new ApiError('Current password does not match', 400, 'INVALID_CURRENT_PASSWORD');
      }
    }

    const existing = await identityStore.getUserByEmail(cleanEmail);
    if (existing && existing.id !== userId) {
      throw new ApiError('An account with this email already exists', 409, 'EMAIL_ALREADY_REGISTERED');
    }

    const rawToken = cryptoService.generateSecureToken(32);
    const tokenHash = cryptoService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString();

    const dbToken: DbEmailVerificationToken = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      token_hash: tokenHash,
      new_email: cleanEmail,
      expires_at: expiresAt,
      used_at: null,
      created_at: new Date().toISOString(),
    };
    await identityStore.saveEmailVerificationToken(dbToken);

    await auditService.logEvent('email.change_requested', {
      userId,
      severity: 'INFO',
      entityType: 'user',
      entityId: userId,
      metadata: { newEmail: cleanEmail },
    });

    return {
      success: true,
      verificationToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  /**
   * Deactivates / soft-deletes a user account.
   */
  public async deleteAccount(userId: string): Promise<{ success: boolean }> {
    const dbUser = await identityStore.getUser(userId);
    if (!dbUser) {
      throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
    }

    dbUser.status = 'deactivated';
    dbUser.updated_at = new Date().toISOString();
    await identityStore.saveUser(dbUser);

    await sessionService.revokeAllUserSessions(userId, { reason: 'User closed account' });

    await auditService.logEvent('account.deactivated', {
      userId,
      severity: 'CRITICAL',
      entityType: 'user',
      entityId: userId,
    });

    return { success: true };
  }
}

export const authService = AuthService.getInstance();
