import { describe, it, expect } from 'vitest';
import { safetyValidator } from '../safety-validator';
import { SwapRouteOption } from '../types';

describe('Slippage Bounds & Quote Drift (Sprint 47 §23-27, §94)', () => {
  const baseRoute: SwapRouteOption = {
    routeId: 'r1',
    routeType: 'DIRECT' as any,
    hops: 1,
    legs: [{ tokenIn: 'SOL', tokenOut: 'USDC', poolAddress: '0xPool', protocol: 'RAYDIUM', feeBps: 25 }],
    expectedOutput: '150.0',
    minimumReceived: '149.25',
    priceImpactPct: 0.1,
    estimatedGasUnits: 40000,
    estimatedNetworkFeeUsd: 0.001,
    protocolFeeUsd: 0.375,
    compositeScore: 98,
    isBestRoute: true,
  };

  it('rejects excessive user slippage tolerance exceeding platform maximum (SLIPPAGE_TOO_HIGH)', async () => {
    const req = {
      idempotencyKey: 'k1',
      userId: 'u1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: '1.0',
      slippage: 12.5, // > 5% max limit
      quoteId: 'q1',
    };

    const res = await safetyValidator.evaluateSafety(req, baseRoute);
    expect(res.isSafe).toBe(false);
    expect(res.failureCode).toBe('SLIPPAGE_TOO_HIGH');
  });

  it('detects excessive market price movement / quote drift (QUOTE_MOVED)', async () => {
    const req = {
      idempotencyKey: 'k2',
      userId: 'u1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: '1.0',
      slippage: 1.0,
      quoteId: 'q1',
    };

    // Route with high price impact drift (> 1.5% max drift)
    const driftedRoute: SwapRouteOption = {
      ...baseRoute,
      priceImpactPct: 2.8,
    };

    const res = await safetyValidator.evaluateSafety(req, driftedRoute);
    expect(res.isSafe).toBe(false);
    expect(res.failureCode).toBe('QUOTE_MOVED');
  });
});
