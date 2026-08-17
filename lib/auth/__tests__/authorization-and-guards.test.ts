import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authorizationService } from '@/lib/auth/authorization-service';
import { authService } from '@/lib/auth/auth-service';
import { walletService } from '@/lib/auth/wallet-service';
import { sessionService } from '@/lib/auth/session-service';

describe('AuthorizationService - Resource Permissions & Security Guards', () => {
  let userA: string;
  let userB: string;
  let walletAId: string;

  beforeEach(async () => {
    dbRepository.reset();
    const regA = await authService.register({
      email: 'guard.a@sentinel.market',
      password: 'Password123!',
    });
    userA = regA.user.id;

    const regB = await authService.register({
      email: 'guard.b@sentinel.market',
      password: 'Password123!',
    });
    userB = regB.user.id;

    const challenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId: userA,
    });
    const link = await walletService.verifyAndLinkWallet({
      userId: userA,
      challengeId: challenge.id,
      signature: 'solana_sig_1',
    });
    walletAId = link.wallet.id;
  });

  it('correctly asserts wallet ownership', async () => {
    expect(await authorizationService.canAccessWallet(userA, walletAId)).toBe(true);
    expect(await authorizationService.canAccessWallet(userB, walletAId)).toBe(false);
  });

  it('asserts user account status', async () => {
    await expect(authorizationService.assertUserActive(userA)).resolves.not.toThrow();

    const dbUserB = dbRepository.getUser(userB)!;
    dbUserB.status = 'suspended';
    dbRepository.saveUser(dbUserB);

    await expect(authorizationService.assertUserActive(userB)).rejects.toThrow('Account has been suspended');
  });

  it('enforces step-up reauthentication if session age exceeds max threshold', async () => {
    const { session } = await sessionService.createSession(userA);

    // Fresh session within 300s window
    expect(() => authorizationService.requireRecentAuthentication(session, 300)).not.toThrow();

    // Stale session (older than 300s)
    const oldSession = {
      ...session,
      createdAt: new Date(Date.now() - 360 * 1000).toISOString(),
    };
    expect(() => authorizationService.requireRecentAuthentication(oldSession, 300)).toThrow(
      'This sensitive action requires recent authentication'
    );
  });
});
