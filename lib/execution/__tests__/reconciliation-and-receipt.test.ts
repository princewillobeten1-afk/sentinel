import { describe, it, expect, beforeEach } from 'vitest';
import { reconciliationService } from '../reconciliation-service';
import { dbRepository } from '../../db/repository';
import { masterWalletProvider } from '../../wallet/wallet-provider';

describe('Reconciliation & Execution Receipts (Sprint 47 §55-61)', () => {
  beforeEach(() => {
    dbRepository.reset();
    masterWalletProvider.reset();
  });

  it('reconciles wallet balances, computes effective price, and issues ExecutionReceipt', async () => {
    const route = {
      routeId: 'r_rec',
      routeType: 'DIRECT' as any,
      hops: 1,
      legs: [{ tokenIn: 'SOL', tokenOut: 'USDC', poolAddress: '0xPool', protocol: 'RAYDIUM', feeBps: 25 }],
      expectedOutput: '150.000000',
      minimumReceived: '149.250000',
      priceImpactPct: 0.1,
      estimatedGasUnits: 40000,
      estimatedNetworkFeeUsd: 0.002,
      protocolFeeUsd: 0.375,
      compositeScore: 98,
      isBestRoute: true,
    };

    const { receipt, quality } = await reconciliationService.reconcile({
      executionId: 'exec_rec_01',
      transactionHash: '0xTxHashConfirmed',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: '1.0',
      expectedOutput: '150.000000',
      actualOutput: '150.250000',
      route,
    });

    expect(receipt.executionId).toBe('exec_rec_01');
    expect(receipt.effectivePrice).toBe('150.250000'); // 150.25 / 1.0
    expect(receipt.priceDeviationPct).toBeGreaterThan(0);
    expect(receipt.transactionHash).toBe('0xTxHashConfirmed');

    expect(quality.executedPrice).toBe(150.25);
    expect(quality.totalFeesUsd).toBeGreaterThan(0);

    const savedReceipt = dbRepository.getReceiptByExecutionId('exec_rec_01');
    expect(savedReceipt).toBeDefined();
    expect(savedReceipt?.transaction_hash).toBe('0xTxHashConfirmed');
  });
});
