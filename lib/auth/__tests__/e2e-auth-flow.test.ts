import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { sessionService } from '@/lib/auth/session-service';
import { walletService } from '@/lib/auth/wallet-service';
import { authorizationService } from '@/lib/auth/authorization-service';

describe('Auth & Identity - Complete End-to-End Flow', () => {
  beforeEach(async () => {
    dbRepository.reset();
  });

  it('executes the full identity lifecycle: Register -> Login -> Connect Multi-Wallets -> Rotate Session -> Logout-All', async () => {
    // 1. User registers
    const registerRes = await authService.register({
      email: 'master.trader@sentinel.market',
      password: 'MasterPassword123!',
      displayName: 'MasterTrader',
      ip: '10.10.10.1',
      userAgent: 'Chrome/120',
    });
    const userId = registerRes.user.id;
    expect(registerRes.user.displayName).toBe('MasterTrader');

    // 2. Email verification
    const emailVerifyRes = await authService.verifyEmail(registerRes.emailVerificationToken!);
    expect(emailVerifyRes.success).toBe(true);

    // 3. User logs in from a second device
    const loginRes = await authService.login({
      email: 'master.trader@sentinel.market',
      password: 'MasterPassword123!',
      ip: '10.10.10.2',
      userAgent: 'Mobile/iOS',
    });
    expect(loginRes.token).toBeDefined();

    // 4. Connect Solana wallet
    const solChallenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });
    const solLink = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: solChallenge.id,
      signature: 'solana_sig_master_1',
      label: 'Primary Solana',
    });
    expect(solLink.wallet.isPrimary).toBe(true);

    // 5. Connect Ethereum wallet
    const ethChallenge = await walletService.createChallenge({
      walletAddress: '0x71C67Ed34F8C98FA6270E480d46C5e0Bebf288F1',
      chainId: '1',
      userId,
    });
    const ethLink = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: ethChallenge.id,
      signature: '0x_mock_eth_sig',
      label: 'Secondary EVM',
    });
    expect(ethLink.wallet.isPrimary).toBe(false);

    // 6. User changes default wallet to Ethereum
    await walletService.setDefaultWallet(userId, ethLink.wallet.id);
    const userWallets = await walletService.getUserWallets(userId);
    expect(userWallets.find((w) => w.id === ethLink.wallet.id)?.isPrimary).toBe(true);
    expect(userWallets.find((w) => w.id === solLink.wallet.id)?.isPrimary).toBe(false);

    // 7. Ownership check
    expect(await authorizationService.canAccessWallet(userId, solLink.wallet.id)).toBe(true);
    expect(await authorizationService.canAccessWallet('other_user', solLink.wallet.id)).toBe(false);

    // 8. User changes password
    const changePwRes = await authService.changePassword(
      userId,
      'MasterPassword123!',
      'NewMasterPassword456!',
      loginRes.session.id
    );
    expect(changePwRes.success).toBe(true);

    // Initial session should be revoked, login session should still be valid
    expect((await sessionService.validateSession(registerRes.session.id)).isValid).toBe(false);
    expect((await sessionService.validateSession(loginRes.session.id)).isValid).toBe(true);

    // 9. User triggers Logout-All
    const logoutAllCount = await sessionService.revokeAllUserSessions(userId);
    expect(logoutAllCount).toBeGreaterThanOrEqual(1);

    // All sessions are now revoked
    expect((await sessionService.validateSession(loginRes.session.id)).isValid).toBe(false);

    // 10. Login with new password works
    const finalLogin = await authService.login({
      email: 'master.trader@sentinel.market',
      password: 'NewMasterPassword456!',
    });
    expect(finalLogin.user.id).toBe(userId);
  });
});
