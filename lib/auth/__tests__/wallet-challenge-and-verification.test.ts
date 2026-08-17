import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { walletService } from '@/lib/auth/wallet-service';

describe('WalletService - Challenge & Verification', () => {
  let userId: string;

  beforeEach(async () => {
    dbRepository.reset();
    const reg = await authService.register({
      email: 'wallet.user@sentinel.market',
      password: 'WalletPassword123!',
    });
    userId = reg.user.id;
  });

  it('generates standard SIWS challenge for Solana address with 10 min expiration', async () => {
    const challenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });

    expect(challenge.id.startsWith('chl_')).toBe(true);
    expect(challenge.nonce).toBeDefined();
    expect(challenge.message).toContain('wants you to sign in with your Solana account');
    expect(challenge.message).toContain('7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm');
    expect(challenge.message).toContain('This signature verifies ownership of your wallet. It does not authorize a transaction.');
    expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`);

    // Expiration should be roughly 10 minutes in the future
    const expMs = new Date(challenge.expiresAt).getTime() - Date.now();
    expect(expMs).toBeGreaterThan(580 * 1000);
    expect(expMs).toBeLessThanOrEqual(600 * 1000);
  });

  it('generates standard SIWE challenge for Ethereum address', async () => {
    const challenge = await walletService.createChallenge({
      walletAddress: '0x71C67Ed34F8C98FA6270E480d46C5e0Bebf288F1',
      chainId: '1',
      userId,
    });

    expect(challenge.message).toContain('wants you to sign in with your Ethereum account');
    expect(challenge.message).toContain('0x71C67Ed34F8C98FA6270E480d46C5e0Bebf288F1');
  });

  it('verifies signature and links wallet to authenticated user', async () => {
    const challenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });

    const linkResult = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: challenge.id,
      signature: 'solana_sig_123456789_mock_valid',
      label: 'Main Trading Phantom',
    });

    expect(linkResult.wallet).toBeDefined();
    expect(linkResult.wallet.address).toBe('7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm');
    expect(linkResult.wallet.userId).toBe(userId);
    expect(linkResult.wallet.isPrimary).toBe(true);
    expect(linkResult.wallet.label).toBe('Main Trading Phantom');

    // Verification record was persisted
    const verifications = dbRepository.getWalletVerifications(linkResult.wallet.id);
    expect(verifications.length).toBe(1);
    expect(verifications[0].challenge_id).toBe(challenge.id);
  });

  it('prevents replay attacks on already-consumed challenges', async () => {
    const challenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });

    // First verification succeeds
    await walletService.verifyAndLinkWallet({
      userId,
      challengeId: challenge.id,
      signature: 'solana_sig_valid_1',
    });

    // Replay with identical challenge must fail
    await expect(
      walletService.verifyAndLinkWallet({
        userId,
        challengeId: challenge.id,
        signature: 'solana_sig_valid_1',
      })
    ).rejects.toThrow('Challenge has already been used');
  });

  it('rejects expired challenges', async () => {
    const challenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });

    // Force expiration in DB
    const dbChallenge = dbRepository.getAuthChallenge(challenge.id)!;
    dbChallenge.expires_at = new Date(Date.now() - 1000).toISOString();
    dbRepository.saveAuthChallenge(dbChallenge);

    await expect(
      walletService.verifyAndLinkWallet({
        userId,
        challengeId: challenge.id,
        signature: 'solana_sig_valid_1',
      })
    ).rejects.toThrow('Challenge has expired');
  });
});
