import { describe, it, expect, beforeEach } from 'vitest';
import { quoteValidator } from '../quote-validator';
import { quoteService } from '../../quote/quote-service';

describe('Quote Validator & Integrity Verification (Sprint 47 §5-7, §93)', () => {
  beforeEach(() => {
    quoteService.reset();
  });

  it('validates authentic server-issued quotes matching token pair and amount', async () => {
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '1.5',
      slippage: 0.5,
    });

    const res = quoteValidator.validate({
      idempotencyKey: 'key_valid_01',
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '1.5',
      slippage: 0.5,
      quoteId: quote.id,
    });

    expect(res.isValid).toBe(true);
    expect(res.quote).toBeDefined();
  });

  it('strictly rejects tampered amount or token pairs (QUOTE_MISMATCH)', async () => {
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '1.0',
      slippage: 0.5,
    });

    // Tampered amount: quote is 1.0, request is 10.0
    const resTamperedAmount = quoteValidator.validate({
      idempotencyKey: 'key_tamper_01',
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '10.0',
      slippage: 0.5,
      quoteId: quote.id,
    });

    expect(resTamperedAmount.isValid).toBe(false);
    expect(resTamperedAmount.failureCode).toBe('QUOTE_MISMATCH');

    // Tampered tokenOut
    const resTamperedToken = quoteValidator.validate({
      idempotencyKey: 'key_tamper_02',
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'FakeMaliciousTokenAddress',
      amountIn: '1.0',
      slippage: 0.5,
      quoteId: quote.id,
    });

    expect(resTamperedToken.isValid).toBe(false);
    expect(resTamperedToken.failureCode).toBe('QUOTE_MISMATCH');
  });

  it('rejects expired quotes (QUOTE_EXPIRED)', async () => {
    const quote = await quoteService.getQuote({
      chainId: 'solana',
      inputToken: 'SOL',
      outputToken: 'So11111111111111111111111111111111111111112',
      amount: '1.0',
      slippage: 0.5,
    });

    // Expire quote manually
    quote.isValid = false;
    quote.expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = quoteValidator.validate({
      idempotencyKey: 'key_expired_01',
      userId: 'user_test',
      walletAddress: '7xK9...3a19',
      chainId: 'solana',
      tokenIn: 'SOL',
      tokenOut: 'So11111111111111111111111111111111111111112',
      amountIn: '1.0',
      slippage: 0.5,
      quoteId: quote.id,
    });

    expect(res.isValid).toBe(false);
    expect(res.failureCode).toBe('QUOTE_EXPIRED');
  });
});
