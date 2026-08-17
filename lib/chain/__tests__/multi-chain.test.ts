import { describe, it, expect } from 'vitest';
import { MultiChainRegistry } from '../multi-chain';

describe('Multi-Chain Abstraction Architecture', () => {
  it('registers and retrieves adapters across multiple blockchain ecosystems', () => {
    const registry = MultiChainRegistry.getInstance();
    const chains = registry.getSupportedChains();

    const chainIds = chains.map((c) => c.chainId);
    expect(chainIds).toContain('solana-mainnet');
    expect(chainIds).toContain('ethereum-mainnet');
    expect(chainIds).toContain('base-mainnet');
  });

  it('exposes uniform chain queries and simulation across Solana and EVM', async () => {
    const registry = MultiChainRegistry.getInstance();

    const solana = registry.getAdapter('solana-mainnet');
    const solBalance = await solana.getBalance('mock_sol_pubkey');
    expect(solBalance.native).toBe(1.5);
    expect(solBalance.tokens.length).toBeGreaterThan(0);

    const base = registry.getAdapter('base-mainnet');
    const baseBalance = await base.getBalance('0xmock_evm_address');
    expect(baseBalance.native).toBe(2.5);
    expect(baseBalance.tokens[0].symbol).toBe('USDC');

    const sim = await base.simulateTransaction({});
    expect(sim.success).toBe(true);
    expect(sim.expectedOut).toBe(1250);
  });
});
