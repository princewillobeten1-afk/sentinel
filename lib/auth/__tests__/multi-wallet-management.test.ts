import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { walletService } from '@/lib/auth/wallet-service';

describe('WalletService - Multi-Wallet Management', () => {
  let userId: string;

  beforeEach(async () => {
    dbRepository.reset();
    const reg = await authService.register({
      email: 'multiwallet@sentinel.market',
      password: 'Password123!',
    });
    userId = reg.user.id;
  });

  it('links multiple wallets across Solana and Ethereum chains to one user', async () => {
    // 1. Solana wallet
    const solChallenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });
    const solWallet = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: solChallenge.id,
      signature: 'solana_sig_1',
      label: 'Solana Phantom',
    });

    // 2. Ethereum wallet
    const ethChallenge = await walletService.createChallenge({
      walletAddress: '0x71C67Ed34F8C98FA6270E480d46C5e0Bebf288F1',
      chainId: '1',
      userId,
    });
    const ethWallet = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: ethChallenge.id,
      signature: '0x_mock_eth_sig',
      label: 'Ethereum MetaMask',
    });

    // First wallet should be default/primary, second should not
    expect(solWallet.wallet.isPrimary).toBe(true);
    expect(ethWallet.wallet.isPrimary).toBe(false);

    const allWallets = await walletService.getUserWallets(userId);
    expect(allWallets.length).toBe(2);
  });

  it('changes default/primary wallet designation', async () => {
    const solChallenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });
    const w1 = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: solChallenge.id,
      signature: 'solana_sig_1',
    });

    const ethChallenge = await walletService.createChallenge({
      walletAddress: '0x71C67Ed34F8C98FA6270E480d46C5e0Bebf288F1',
      chainId: '1',
      userId,
    });
    const w2 = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: ethChallenge.id,
      signature: '0x_mock_eth_sig',
    });

    expect(w1.wallet.isPrimary).toBe(true);
    expect(w2.wallet.isPrimary).toBe(false);

    // Set Ethereum wallet as default
    await walletService.setDefaultWallet(userId, w2.wallet.id);

    const updatedWallets = await walletService.getUserWallets(userId);
    const updatedW1 = updatedWallets.find((w) => w.id === w1.wallet.id)!;
    const updatedW2 = updatedWallets.find((w) => w.id === w2.wallet.id)!;

    expect(updatedW1.isPrimary).toBe(false);
    expect(updatedW2.isPrimary).toBe(true);
  });

  it('disconnects a wallet, setting status to disconnected while preserving records', async () => {
    const solChallenge = await walletService.createChallenge({
      walletAddress: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chainId: 'solana',
      userId,
    });
    const w1 = await walletService.verifyAndLinkWallet({
      userId,
      challengeId: solChallenge.id,
      signature: 'solana_sig_1',
    });

    const disconnectRes = await walletService.disconnectWallet(userId, w1.wallet.id);
    expect(disconnectRes.success).toBe(true);

    const dbW = dbRepository.getWallet(w1.wallet.id);
    expect(dbW?.status).toBe('disconnected');
    expect(dbW?.is_primary).toBe(false);
  });
});
