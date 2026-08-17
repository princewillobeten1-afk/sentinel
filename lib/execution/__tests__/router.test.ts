import { describe, it, expect } from 'vitest';
import { MultiDexRouter, RaydiumDexAdapter, OrcaDexAdapter } from '../router';
import { ExecutionRequest, ExecutionPolicy, MEVPreference } from '../types';

describe('Multi-DEX Routing & Liquidity Aggregation Architecture', () => {
  it('queries multiple DEX venues and selects optimal execution route', async () => {
    const router = new MultiDexRouter([
      new RaydiumDexAdapter(),
      new OrcaDexAdapter(),
    ]);

    const request: ExecutionRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000', // 1 SOL
      slippageLimit: 0.01,
      priority: 'NORMAL',
      wallet: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chain: 'solana',
      side: 'SWAP',
      orderType: 'MARKET',
      executionPolicy: ExecutionPolicy.BEST_PRICE,
      mevPreference: MEVPreference.STANDARD,
    };

    const result = await router.findBestRoute(request);

    expect(result.totalVenuesQueried).toBe(2);
    expect(result.totalLiquidityUsd).toBeGreaterThan(5_000_000);
    expect(result.bestRoute).toBeDefined();
    expect(result.selectedVenue).toBe('RAYDIUM_CLMM'); // Higher expected output (1.05x vs 1.04x)
    expect(result.allRoutes.length).toBe(2);
    expect(result.allRoutes[0].isBestRoute).toBe(true);
  });

  it('tolerates individual DEX failures without failing aggregation query', async () => {
    const faultyAdapter = {
      getIdentifier: () => 'FAULTY_DEX',
      getQuote: async () => {
        throw new Error('503 Service Unavailable');
      },
      getLiquidity: async () => 0,
      buildSwap: async () => '',
      simulateSwap: async () => ({ willRevert: true, expectedTokenOutput: '0', estimatedGasUsage: 0, warnings: [] }),
      healthCheck: async () => ({ isHealthy: false, latencyMs: 999 }),
    };

    const router = new MultiDexRouter([
      faultyAdapter,
      new OrcaDexAdapter(),
    ]);

    const request: ExecutionRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000',
      slippageLimit: 0.01,
      priority: 'NORMAL',
      wallet: '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoZNUJnm',
      chain: 'solana',
      side: 'SWAP',
      orderType: 'MARKET',
      executionPolicy: ExecutionPolicy.BEST_PRICE,
      mevPreference: MEVPreference.STANDARD,
    };

    const result = await router.findBestRoute(request);
    expect(result.bestRoute).toBeDefined();
    expect(result.selectedVenue).toBe('ORCA_WHIRLPOOL');
  });
});
