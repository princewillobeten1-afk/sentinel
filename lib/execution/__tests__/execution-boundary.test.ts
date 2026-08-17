import { describe, it, expect, beforeEach } from 'vitest';
import { executionService } from '../execution-service';
import { quoteService } from '../../quote/quote-service';

describe('Execution Service Boundary (Sprint 46 §44-47, §81-86)', () => {
  beforeEach(() => {
    executionService.reset();
    quoteService.reset();
  });

  it('prepares and simulates transactions without direct RPC calls', async () => {
    const quote = await quoteService.getQuote({
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '1.0',
      slippage: 0.5,
    });

    const { intent, preparedTx } = await executionService.prepareTransaction({
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      quoteId: quote.id,
    });

    expect(intent.intentId).toBeDefined();
    expect(preparedTx.simulationRequired).toBe(true);

    const simulation = await executionService.simulateTransaction(intent.intentId);
    expect(simulation.success).toBe(true);
    expect(simulation.estimatedGasUnits).toBeGreaterThan(0);
  });

  it('submits signed transaction and updates lifecycle state to CONFIRMED', async () => {
    const quote = await quoteService.getQuote({
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '1.0',
      slippage: 0.5,
    });

    const { intent } = await executionService.prepareTransaction({
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      quoteId: quote.id,
    });

    await executionService.simulateTransaction(intent.intentId);

    const submission = await executionService.submitTransaction({
      intentId: intent.intentId,
      signatureHexOrBase58: '5xSigExampleSolanaHash',
    });

    expect(submission.status).toBe('CONFIRMED');
    expect(submission.txHash).toBeDefined();

    const status = executionService.getTransactionStatus(intent.intentId);
    expect(status?.state).toBe('CONFIRMED');
  });
});
