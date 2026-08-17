import { describe, it, expect } from 'vitest';
import { simulator } from '../simulator';
import { safetyValidator } from '../safety-validator';
import { routeEngine } from '../route-engine';

describe('Simulation & Safety Validator (Sprint 47 §28-30, §68, §95)', () => {
  it('runs pre-flight dry-run simulation and verifies minimum output tokens', async () => {
    const req = {
      idempotencyKey: 'sim_test_01',
      userId: 'user_1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '1.0',
      slippage: 0.5,
      quoteId: 'quote_test',
    };

    const { bestRoute } = await routeEngine.findBestRoute(req);
    const payload = {
      chainId: 'solana',
      from: req.walletAddress,
      data: '0xMockSimulationData',
    };

    const sim = await simulator.simulate('solana', payload, bestRoute);
    expect(sim.success).toBe(true);
    expect(sim.minimumOutputVerified).toBe(true);
    expect(sim.estimatedGasUsage).toBeGreaterThan(0);
  });

  it('rejects simulation if simulated output is below minimum received threshold', async () => {
    const route = {
      routeId: 'r_violation',
      routeType: 'DIRECT' as any,
      hops: 1,
      legs: [],
      expectedOutput: '150.0',
      minimumReceived: '200.0', // Impossible min received
      priceImpactPct: 0.1,
      estimatedGasUnits: 40000,
      estimatedNetworkFeeUsd: 0.001,
      protocolFeeUsd: 0.375,
      compositeScore: 90,
      isBestRoute: true,
    };

    const payload = { chainId: 'solana', from: '0xWallet' };
    const sim = await simulator.simulate('solana', payload, route);
    expect(sim.success).toBe(false);
    expect(sim.revertReason).toContain('less than enforced minimum');
  });
});
