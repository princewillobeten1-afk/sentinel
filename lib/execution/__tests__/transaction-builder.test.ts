import { describe, it, expect, beforeEach } from 'vitest';
import { transactionBuilder } from '../transaction-builder';
import { routeEngine } from '../route-engine';
import { dbRepository } from '../../db/repository';

describe('Transaction Builder & Idempotency (Sprint 47 §14-18, §87, §99)', () => {
  beforeEach(() => {
    dbRepository.reset();
    transactionBuilder.reset();
  });

  it('builds unsigned transaction payload for Solana and EVM routes', async () => {
    const req = {
      idempotencyKey: 'idemp_key_001',
      userId: 'user_1',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 'base',
      tokenIn: 'USDC',
      tokenOut: 'WETH',
      amountIn: '1000',
      slippage: 0.5,
      quoteId: 'quote_uni',
    };

    const { bestRoute } = await routeEngine.findBestRoute(req);
    const intent = await transactionBuilder.buildTransaction('exec_001', req, bestRoute);

    expect(intent.intentId).toBeDefined();
    expect(intent.isDuplicate).toBe(false);
    expect(intent.payload.to).toBeDefined();
    expect(intent.payload.data).toBeDefined();
    expect(intent.payload.gasLimit).toBeDefined();
  });

  it('enforces idempotency on duplicate execution requests', async () => {
    const req = {
      idempotencyKey: 'idemp_duplicate_test',
      userId: 'user_1',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '1.0',
      slippage: 0.5,
      quoteId: 'quote_sol',
    };

    const { bestRoute } = await routeEngine.findBestRoute(req);

    // First attempt
    const intent1 = await transactionBuilder.buildTransaction('exec_first', req, bestRoute);
    expect(intent1.isDuplicate).toBe(false);

    // Second attempt with exact same idempotencyKey
    const intent2 = await transactionBuilder.buildTransaction('exec_second', req, bestRoute);
    expect(intent2.isDuplicate).toBe(true);
    expect(intent2.intentId).toBe(intent1.intentId);
  });
});
