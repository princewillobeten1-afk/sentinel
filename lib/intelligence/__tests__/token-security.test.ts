import { describe, expect, it } from 'vitest';
import { evaluateTokenSecurity } from '../engines/token-security';
import type { TokenSecurityData } from '@/lib/api/birdeye/security';

function buildInput(security: TokenSecurityData) {
  return { tokenId: 'tok_test', chain: 'solana', dataTimestamp: '2026-08-13T00:00:00.000Z', security };
}

describe('evaluateTokenSecurity — EVM branch', () => {
  it('flags a detected honeypot with a heavy score penalty', () => {
    const result = evaluateTokenSecurity(buildInput({ isHoneypot: '1' }));
    expect(result.scoreAdjustment).toBeLessThanOrEqual(-50);
    expect(result.signals.some((s) => s.type === 'HONEYPOT_DETECTED')).toBe(true);
    expect(result.missingData).toHaveLength(0);
  });

  it('does not flag isHoneypot="0" as a honeypot', () => {
    const result = evaluateTokenSecurity(buildInput({ isHoneypot: '0' }));
    expect(result.signals.some((s) => s.type === 'HONEYPOT_DETECTED')).toBe(false);
    expect(result.missingData).toHaveLength(0); // field was present, just false
  });

  it('flags cannotSellAll', () => {
    const result = evaluateTokenSecurity(buildInput({ cannotSellAll: '1' }));
    expect(result.signals.some((s) => s.type === 'CANNOT_SELL_ALL')).toBe(true);
  });

  it('flags creator-linked honeypot history', () => {
    const result = evaluateTokenSecurity(buildInput({ honeypotWithSameCreator: '1' }));
    expect(result.signals.some((s) => s.type === 'CREATOR_LINKED_HONEYPOT')).toBe(true);
  });

  it('flags high buy/sell tax above the threshold', () => {
    const result = evaluateTokenSecurity(buildInput({ buyTax: '25', sellTax: '30' }));
    expect(result.signals.some((s) => s.type === 'HIGH_BUYTAX')).toBe(true);
    expect(result.signals.some((s) => s.type === 'HIGH_SELLTAX')).toBe(true);
  });

  it('does not flag tax at or below the threshold', () => {
    const result = evaluateTokenSecurity(buildInput({ buyTax: '5', sellTax: '10' }));
    expect(result.signals.some((s) => s.type.startsWith('HIGH_'))).toBe(false);
  });
});

describe('evaluateTokenSecurity — Solana branch', () => {
  it('heavily penalizes a non-transferable token', () => {
    const result = evaluateTokenSecurity(buildInput({ nonTransferable: true }));
    expect(result.scoreAdjustment).toBeLessThanOrEqual(-50);
    expect(result.signals.some((s) => s.type === 'NON_TRANSFERABLE')).toBe(true);
  });

  it('does not flag nonTransferable: false', () => {
    const result = evaluateTokenSecurity(buildInput({ nonTransferable: false }));
    expect(result.signals.some((s) => s.type === 'NON_TRANSFERABLE')).toBe(false);
    expect(result.missingData).toHaveLength(0);
  });

  it('flags an enabled Token-2022 transfer fee', () => {
    const result = evaluateTokenSecurity(buildInput({ transferFeeEnable: true }));
    expect(result.signals.some((s) => s.type === 'TRANSFER_FEE_ENABLED')).toBe(true);
  });

  it('flags the Token-2022 + freezeable combination', () => {
    const result = evaluateTokenSecurity(buildInput({ isToken2022: true, freezeable: true }));
    expect(result.signals.some((s) => s.type === 'TOKEN2022_FREEZEABLE')).toBe(true);
  });

  it('does not flag Token-2022 alone without freeze authority', () => {
    const result = evaluateTokenSecurity(buildInput({ isToken2022: true, freezeable: false }));
    expect(result.signals.some((s) => s.type === 'TOKEN2022_FREEZEABLE')).toBe(false);
  });
});

describe('evaluateTokenSecurity — missing data', () => {
  it('reports missing data with no score penalty when nothing is populated', () => {
    const result = evaluateTokenSecurity(buildInput({}));
    expect(result.scoreAdjustment).toBe(0);
    expect(result.signals).toHaveLength(0);
    expect(result.missingData).toHaveLength(1);
    expect(result.missingData[0].impact).toBe('INFORMATIONAL');
  });
});
