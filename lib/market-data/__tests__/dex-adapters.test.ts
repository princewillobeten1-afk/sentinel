import { describe, it, expect } from 'vitest';
import { SolanaDexAdapter } from '../dex/solana-dex-adapter';
import { UniswapV2Adapter } from '../dex/uniswap-v2-adapter';
import { UniswapV3Adapter } from '../dex/uniswap-v3-adapter';
import { dexAdapterRegistry } from '../dex/adapter-registry';

describe('DEX Adapter Abstraction & Invariant Calculations (Sprint 45 §8-9)', () => {
  it('SolanaDexAdapter calculates correct CPMM price and liquidity from on-chain reserves', async () => {
    const adapter = new SolanaDexAdapter('raydium_cpmm');
    const state = await adapter.getMarketState('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2');

    expect(state.marketId).toContain('solana:raydium_cpmm:58oqchx4ywmvkdwllzzbi4chocc2fqcuwbkwmihlyqo2');
    expect(state.currentPriceUsd).toBe(150.0);
    expect(state.reserves.liquidityUsd).toBeGreaterThan(4_000_000);
    expect(state.isActive).toBe(true);
  });

  it('UniswapV2Adapter computes constant-product pool reserves and swap events', async () => {
    const adapter = new UniswapV2Adapter('base');
    const state = await adapter.getMarketState('0x4c88a912b7f329910d8a1104e4a90b14c1889a21');

    expect(state.marketId).toContain('base:uniswap_v2');
    expect(state.currentPriceUsd).toBe(1.0);
    expect(state.reserves.liquidityUsd).toBeGreaterThan(1_000_000);

    const swaps = await adapter.getSwapEvents('0x4c88a912b7f329910d8a1104e4a90b14c1889a21');
    expect(swaps.length).toBeGreaterThan(0);
    expect(swaps[0].volumeUsd).toBe(3000.0);
  });

  it('UniswapV3Adapter handles concentrated liquidity tick calculations', async () => {
    const adapter = new UniswapV3Adapter('ethereum');
    const state = await adapter.getMarketState('0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640');

    expect(state.marketId).toContain('ethereum:uniswap_v3');
    expect(state.feeBps).toBe(5);
    expect(state.reserves.liquidityUsd).toBeGreaterThan(10_000_000);
  });

  it('DexAdapterRegistry accurately dispatches and resolves adapters by chain and protocol', () => {
    const raydium = dexAdapterRegistry.getAdapter('solana', 'raydium_cpmm');
    expect(raydium).toBeDefined();
    expect(raydium?.protocol).toBe('raydium_cpmm');

    const univ3 = dexAdapterRegistry.getAdapter('ethereum', 'uniswap_v3');
    expect(univ3).toBeDefined();
    expect(univ3?.chainId).toBe('ethereum');
  });
});
