import { describe, it, expect, beforeEach } from 'vitest';
import { gasEstimator } from '../gas-estimator';
import { safetyValidator } from '../safety-validator';
import { masterWalletProvider } from '../../wallet/wallet-provider';

describe('Gas Estimation & Balance Checks (Sprint 47 §19-22)', () => {
  beforeEach(() => {
    masterWalletProvider.reset();
  });

  it('estimates gas limits with a bounded 20% safety buffer', async () => {
    const res = await gasEstimator.estimateGas('ethereum', 100000, 5.0);

    expect(res.estimatedGas).toBe(100000);
    expect(res.gasLimit).toBe(120000); // 100000 * 1.20
    expect(res.baseFeeGwei).toBeDefined();
    expect(res.priorityFeeGwei).toBeDefined();
  });

  it('detects insufficient native gas balance', async () => {
    // Zero native balance
    masterWalletProvider.updateBalance('native', -masterWalletProvider.getBalance('native').amount);

    const route = {
      routeId: 'r_gas',
      routeType: 'DIRECT' as any,
      hops: 1,
      legs: [],
      expectedOutput: '150.0',
      minimumReceived: '149.25',
      priceImpactPct: 0.1,
      estimatedGasUnits: 40000,
      estimatedNetworkFeeUsd: 15.0, // Requires 0.10 SOL
      protocolFeeUsd: 0.375,
      compositeScore: 98,
      isBestRoute: true,
    };

    const req = {
      idempotencyKey: 'k_gas',
      userId: 'u1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: '1.0',
      slippage: 0.5,
      quoteId: 'q1',
    };

    const res = await safetyValidator.evaluateSafety(req, route);
    expect(res.isSafe).toBe(false);
    expect(res.failureCode).toBe('INSUFFICIENT_GAS_BALANCE');
  });
});
