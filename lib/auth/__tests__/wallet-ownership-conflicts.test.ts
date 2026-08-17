import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { walletService } from '@/lib/auth/wallet-service';

describe('WalletService - Ownership Conflicts & Protection', () => {
  let userA: string;
  let userB: string;
  const sharedAddress = '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm';

  beforeEach(async () => {
    dbRepository.reset();
    const regA = await authService.register({
      email: 'usera@sentinel.market',
      password: 'Password123!',
    });
    userA = regA.user.id;

    const regB = await authService.register({
      email: 'userb@sentinel.market',
      password: 'Password123!',
    });
    userB = regB.user.id;
  });

  it('links wallet to User A successfully', async () => {
    const challengeA = await walletService.createChallenge({
      walletAddress: sharedAddress,
      chainId: 'solana',
      userId: userA,
    });

    const resultA = await walletService.verifyAndLinkWallet({
      userId: userA,
      challengeId: challengeA.id,
      signature: 'solana_sig_userA_1',
    });

    expect(resultA.wallet.userId).toBe(userA);
  });

  it('rejects User B attempting to link User A verified wallet with WALLET_ALREADY_LINKED error', async () => {
    // 1. User A links wallet
    const challengeA = await walletService.createChallenge({
      walletAddress: sharedAddress,
      chainId: 'solana',
      userId: userA,
    });
    await walletService.verifyAndLinkWallet({
      userId: userA,
      challengeId: challengeA.id,
      signature: 'solana_sig_userA_1',
    });

    // 2. User B tries to link the same wallet
    const challengeB = await walletService.createChallenge({
      walletAddress: sharedAddress,
      chainId: 'solana',
      userId: userB,
    });

    await expect(
      walletService.verifyAndLinkWallet({
        userId: userB,
        challengeId: challengeB.id,
        signature: 'solana_sig_userB_1',
      })
    ).rejects.toThrow('This wallet address is already linked to another account');
  });

  it('idempotently returns existing wallet if same User A re-links wallet', async () => {
    const challengeA1 = await walletService.createChallenge({
      walletAddress: sharedAddress,
      chainId: 'solana',
      userId: userA,
    });
    const first = await walletService.verifyAndLinkWallet({
      userId: userA,
      challengeId: challengeA1.id,
      signature: 'solana_sig_1',
    });

    const challengeA2 = await walletService.createChallenge({
      walletAddress: sharedAddress,
      chainId: 'solana',
      userId: userA,
    });
    const second = await walletService.verifyAndLinkWallet({
      userId: userA,
      challengeId: challengeA2.id,
      signature: 'solana_sig_2',
    });

    expect(second.wallet.id).toBe(first.wallet.id);
  });
});
