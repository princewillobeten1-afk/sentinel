import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { sessionService } from '@/lib/auth/session-service';

describe('AuthService - Password Reset & Email Verification', () => {
  let userId: string;
  let emailVerificationToken: string;

  beforeEach(async () => {
    dbRepository.reset();
    const reg = await authService.register({
      email: 'recover@sentinel.market',
      password: 'InitialPassword123!',
      displayName: 'RecoverUser',
    });
    userId = reg.user.id;
    emailVerificationToken = reg.emailVerificationToken!;
  });

  it('verifies email with valid single-use token', async () => {
    const result = await authService.verifyEmail(emailVerificationToken);
    expect(result.success).toBe(true);

    const dbUser = dbRepository.getUser(userId);
    expect(dbUser?.email_verified_at).toBeDefined();

    // Reusing the same token should fail
    await expect(authService.verifyEmail(emailVerificationToken)).rejects.toThrow(
      'This verification token has already been used'
    );
  });

  it('handles forgot password flow safely without enumerating non-existent accounts', async () => {
    // Registered account
    const existing = await authService.forgotPassword('recover@sentinel.market');
    expect(existing.message).toContain('password reset link has been dispatched');
    expect(existing.rawTokenForTest).toBeDefined();

    // Non-existent account (identical generic response)
    const unknown = await authService.forgotPassword('nonexistent@sentinel.market');
    expect(unknown.message).toContain('password reset link has been dispatched');
    expect(unknown.rawTokenForTest).toBeUndefined();
  });

  it('resets password using valid token and revokes previous sessions', async () => {
    const sessionBefore = await sessionService.createSession(userId);
    const forgot = await authService.forgotPassword('recover@sentinel.market');
    const rawResetToken = forgot.rawTokenForTest!;

    const resetResult = await authService.resetPassword(rawResetToken, 'NewSecurePassword456!');
    expect(resetResult.success).toBe(true);

    // Old session should now be revoked
    const valOld = await sessionService.validateSession(sessionBefore.session.id);
    expect(valOld.isValid).toBe(false);

    // Can log in with new password
    const loginNew = await authService.login({
      email: 'recover@sentinel.market',
      password: 'NewSecurePassword456!',
    });
    expect(loginNew.user.id).toBe(userId);

    // Reusing reset token must fail
    await expect(authService.resetPassword(rawResetToken, 'AnotherPassword789!')).rejects.toThrow(
      'This reset token has already been used'
    );
  });

  it('allows authenticated password change with current password check', async () => {
    const currentSession = await sessionService.createSession(userId);

    const changeResult = await authService.changePassword(
      userId,
      'InitialPassword123!',
      'UpdatedViaSettingsPassword789!',
      currentSession.session.id
    );
    expect(changeResult.success).toBe(true);

    // Verify bad current password is rejected
    await expect(
      authService.changePassword(userId, 'WrongCurrentPassword!', 'FailPassword123!')
    ).rejects.toThrow('Current password does not match');
  });
});
