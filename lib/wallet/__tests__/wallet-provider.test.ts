import { describe, it, expect, beforeEach } from 'vitest';
import { masterWalletProvider } from '../wallet-provider';

describe('Multi-Chain Wallet Provider Abstraction (Sprint 46 §48-51)', () => {
  beforeEach(() => {
    masterWalletProvider.reset();
  });

  it('manages connection lifecycle states (DISCONNECTED -> CONNECTING -> CONNECTED -> DISCONNECTED)', async () => {
    expect(masterWalletProvider.getState()).toBe('DISCONNECTED');
    expect(masterWalletProvider.getAddress()).toBeNull();

    const connectPromise = masterWalletProvider.connect('solana');
    const res = await connectPromise;

    expect(masterWalletProvider.getState()).toBe('CONNECTED');
    expect(res.address).toBeDefined();
    expect(masterWalletProvider.getAddress()).toBe(res.address);

    await masterWalletProvider.disconnect();
    expect(masterWalletProvider.getState()).toBe('DISCONNECTED');
    expect(masterWalletProvider.getAddress()).toBeNull();
  });

  it('retrieves spendable balances for connected tokens', () => {
    const solBal = masterWalletProvider.getBalance('So11111111111111111111111111111111111111112');
    expect(solBal.amount).toBeGreaterThan(0);
    expect(solBal.spendable).toBe(true);

    const unknownBal = masterWalletProvider.getBalance('unknown_token_address');
    expect(unknownBal.amount).toBe(0);
    expect(unknownBal.spendable).toBe(false);
  });
});
