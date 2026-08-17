import { describe, it, expect, beforeEach } from 'vitest';
import { quoteService } from '../quote-service';

describe('Quote Service & Price Impact Rating (Sprint 46 §38-41)', () => {
  beforeEach(() => {
    quoteService.reset();
  });

  it('computes authoritative swap quotes with exact decimal math and minimum received calculation', async () => {
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '2.5',
      slippage: 1.0,
    });

    expect(quote.id).toBeDefined();
    expect(parseFloat(quote.outputAmount)).toBeGreaterThan(0);
    expect(parseFloat(quote.minimumReceived)).toBeLessThanOrEqual(parseFloat(quote.outputAmount));
    expect(quote.fees.totalFeeUsd).toBeGreaterThan(0);
    expect(quote.isValid).toBe(true);
  });

  it('classifies price impact into LOW, MEDIUM, HIGH, EXTREME ratings', () => {
    expect(quoteService.classifyPriceImpact(0.4)).toBe('LOW');
    expect(quoteService.classifyPriceImpact(1.8)).toBe('MEDIUM');
    expect(quoteService.classifyPriceImpact(3.5)).toBe('HIGH');
    expect(quoteService.classifyPriceImpact(7.2)).toBe('EXTREME');
  });

  it('rejects invalid inputs like non-positive amounts and excessive slippage', async () => {
    await expect(
      quoteService.getQuote({
        inputToken: 'SOL',
        outputToken: 'TOKEN',
        amount: '0',
        slippage: 0.5,
      })
    ).rejects.toThrow('Input amount must be greater than zero');

    await expect(
      quoteService.getQuote({
        inputToken: 'SOL',
        outputToken: 'TOKEN',
        amount: '1',
        slippage: 55, // > 50%
      })
    ).rejects.toThrow('Slippage tolerance must be between 0% and 50%');
  });
});
