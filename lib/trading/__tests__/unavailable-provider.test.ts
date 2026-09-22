import { describe, expect, it } from 'vitest';
import { UnavailableTradingProvider } from '../unavailable-provider';
import type { Quote } from '@/lib/quote/types';

const quote = { id: 'quote-1' } as Quote;

describe('UnavailableTradingProvider', () => {
  it('refuses simulation without claiming a transaction exists', async () => {
    const result = await new UnavailableTradingProvider().simulateTrade({
      quote,
      walletPublicKey: 'wallet',
      availableSol: 1,
      network: 'solana:mainnet',
    });

    expect(result.valid).toBe(false);
    expect(result.transactionPayload).toBeUndefined();
    expect(result.errors[0]).toContain('not configured');
  });

  it('refuses submission instead of fabricating a receipt', async () => {
    await expect(new UnavailableTradingProvider().submitTrade({
      quote,
      walletPublicKey: 'wallet',
      signature: 'signature',
      network: 'solana:mainnet',
      idempotencyKey: 'idempotency',
    })).rejects.toThrow('not configured');
  });
});