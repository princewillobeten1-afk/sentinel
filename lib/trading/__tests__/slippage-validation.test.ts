import { describe, it, expect } from 'vitest';
import { quoteService } from '../../quote/quote-service';

describe('Slippage Controls & Boundaries (Sprint 46 §34-35)', () => {
  it('calculates minimum received output under various slippage tolerances', () => {
    // 100 tokens at 1% slippage = 99 tokens min
    const min1Pct = quoteService.calculateMinimumReceived('100.000000', 1.0);
    expect(min1Pct).toBe('99.000000');

    // 100 tokens at 0.5% slippage = 99.5 tokens min
    const minHalfPct = quoteService.calculateMinimumReceived('100.000000', 0.5);
    expect(minHalfPct).toBe('99.500000');

    // 100 tokens at 0.1% slippage = 99.9 tokens min
    const minTenthPct = quoteService.calculateMinimumReceived('100.000000', 0.1);
    expect(minTenthPct).toBe('99.900000');
  });

  it('rejects invalid or negative slippage tolerance configurations', () => {
    const minZero = quoteService.calculateMinimumReceived('100.000000', 0.0);
    expect(minZero).toBe('100.000000');

    const minNegative = quoteService.calculateMinimumReceived('100.000000', -5.0);
    expect(minNegative).toBe('100.000000'); // Clamped to 0
  });
});
