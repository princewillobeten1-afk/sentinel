import { describe, it, expect } from 'vitest';
import { routeEngine } from '../route-engine';
import { SwapExecutionRequest } from '../types';

describe('Route Engine & Multi-Factor Scoring (Sprint 47 §8-11)', () => {
  it('discovers and ranks routes across registered DEX execution adapters', async () => {
    const req: SwapExecutionRequest = {
      idempotencyKey: 'route_test_01',
      userId: 'user_1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '2.0',
      slippage: 0.5,
      quoteId: 'quote_dummy',
    };

    const { bestRoute, allRoutes } = await routeEngine.findBestRoute(req);

    expect(allRoutes.length).toBeGreaterThan(0);
    expect(bestRoute.isBestRoute).toBe(true);
    expect(bestRoute.compositeScore).toBeGreaterThanOrEqual(90);
    expect(parseFloat(bestRoute.expectedOutput)).toBeGreaterThan(0);
    expect(parseFloat(bestRoute.minimumReceived)).toBeLessThanOrEqual(parseFloat(bestRoute.expectedOutput));
  });

  it('validates route structural integrity', () => {
    const validRoute = {
      routeId: 'r1',
      routeType: 'DIRECT' as any,
      hops: 1,
      legs: [{ tokenIn: 'SOL', tokenOut: 'USDC', poolAddress: '0xPool', protocol: 'RAYDIUM', feeBps: 25 }],
      expectedOutput: '150.00',
      minimumReceived: '149.25',
      priceImpactPct: 0.1,
      estimatedGasUnits: 40000,
      estimatedNetworkFeeUsd: 0.001,
      protocolFeeUsd: 0.375,
      compositeScore: 98,
      isBestRoute: true,
    };

    expect(routeEngine.validateRoute(validRoute)).toBe(true);

    const invalidRoute = { ...validRoute, legs: [] };
    expect(routeEngine.validateRoute(invalidRoute)).toBe(false);
  });
});
