import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { cryptoService } from '@/lib/auth/crypto-service';

describe('AuthService - Registration & Login', () => {
  beforeEach(async () => {
    dbRepository.reset();
  });

  it('successfully registers a new user with hashed password and verification token', async () => {
    const result = await authService.register({
      email: 'trader1@sentinel.market',
      password: 'SecurePassword123!',
      displayName: 'ApexTrader',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 SentinelBrowser',
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('trader1@sentinel.market');
    expect(result.user.displayName).toBe('ApexTrader');
    expect(result.user.status).toBe('active');
    expect(result.session).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.emailVerificationToken).toBeDefined();

    // Verify stored user in DB has hashed password, not plaintext
    const dbUser = dbRepository.getUser(result.user.id);
    expect(dbUser).toBeDefined();
    expect(dbUser?.password_hash).toBeDefined();
    expect(dbUser?.password_hash).not.toBe('SecurePassword123!');
    expect(dbUser?.password_hash?.startsWith('scrypt$')).toBe(true);
  });

  it('rejects duplicate email registrations with 409 conflict', async () => {
    await authService.register({
      email: 'duplicate@sentinel.market',
      password: 'Password123!',
    });

    await expect(
      authService.register({
        email: 'duplicate@sentinel.market',
        password: 'AnotherPassword456!',
      })
    ).rejects.toThrow('An account with this email already exists');
  });

  it('rejects passwords shorter than 8 characters', async () => {
    await expect(
      authService.register({
        email: 'short@sentinel.market',
        password: 'short',
      })
    ).rejects.toThrow('Password must be at least 8 characters long');
  });

  it('authenticates valid credentials and updates last login timestamp', async () => {
    await authService.register({
      email: 'valid@sentinel.market',
      password: 'StrongPassword123!',
      displayName: 'TraderAlpha',
    });

    const loginResult = await authService.login({
      email: 'valid@sentinel.market',
      password: 'StrongPassword123!',
      ip: '10.0.0.1',
      userAgent: 'TerminalApp',
    });

    expect(loginResult.user.email).toBe('valid@sentinel.market');
    expect(loginResult.session).toBeDefined();
    expect(loginResult.token).toBeDefined();

    const dbUser = dbRepository.getUser(loginResult.user.id);
    expect(dbUser?.last_login_at).toBeDefined();
  });

  it('rejects bad password with 401 error', async () => {
    await authService.register({
      email: 'user@sentinel.market',
      password: 'CorrectPassword123!',
    });

    await expect(
      authService.login({
        email: 'user@sentinel.market',
        password: 'WrongPassword!',
      })
    ).rejects.toThrow('Invalid email or password');
  });

  it('blocks login for suspended accounts with 403 forbidden', async () => {
    const reg = await authService.register({
      email: 'suspended@sentinel.market',
      password: 'Password123!',
    });

    // Suspend account
    const dbUser = dbRepository.getUser(reg.user.id)!;
    dbUser.status = 'suspended';
    dbRepository.saveUser(dbUser);

    await expect(
      authService.login({
        email: 'suspended@sentinel.market',
        password: 'Password123!',
      })
    ).rejects.toThrow('Account has been suspended');
  });
});
