import { describe, expect, it } from 'vitest';
import { evaluateApprovalRisk } from '../approval-risk';

describe('evaluateApprovalRisk', () => {
  it('flags the exact max-uint256 sentinel as unlimited/DANGEROUS', () => {
    const maxUint256 = ((2n ** 256n) - 1n).toString();
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: maxUint256,
      walletTokenBalance: '1000000000',
      tokenDecimals: 9,
    });
    expect(result.level).toBe('DANGEROUS');
    expect(result.isUnlimited).toBe(true);
    expect(result.ratioToBalance).toBeNull();
  });

  it('flags a near-max sentinel as unlimited too', () => {
    const nearMax = ((2n ** 256n) - 100n).toString();
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: nearMax,
      walletTokenBalance: '1000000000',
      tokenDecimals: 9,
    });
    expect(result.isUnlimited).toBe(true);
  });

  it('marks a request far exceeding balance as DANGEROUS without being the max sentinel', () => {
    // 1000 SOL requested against a 1 SOL balance (9 decimals) — 1000x ratio.
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: (1000n * 10n ** 9n).toString(),
      walletTokenBalance: (1n * 10n ** 9n).toString(),
      tokenDecimals: 9,
    });
    expect(result.level).toBe('DANGEROUS');
    expect(result.isUnlimited).toBe(false);
    expect(result.ratioToBalance).toBeCloseTo(1000, 0);
  });

  it('marks a moderately-elevated request as ELEVATED', () => {
    // 20x balance — above the 10x ELEVATED threshold, below the 100x DANGEROUS threshold.
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: (20n * 10n ** 9n).toString(),
      walletTokenBalance: (1n * 10n ** 9n).toString(),
      tokenDecimals: 9,
    });
    expect(result.level).toBe('ELEVATED');
  });

  it('marks a proportionate request as SAFE', () => {
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: (1n * 10n ** 9n).toString(),
      walletTokenBalance: (2n * 10n ** 9n).toString(),
      tokenDecimals: 9,
    });
    expect(result.level).toBe('SAFE');
    expect(result.ratioToBalance).toBeCloseTo(0.5, 5);
  });

  it('handles a zero balance without dividing by zero', () => {
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: (1n * 10n ** 9n).toString(),
      walletTokenBalance: '0',
      tokenDecimals: 9,
    });
    expect(result.level).toBe('ELEVATED');
    expect(result.ratioToBalance).toBeNull();
  });

  it('treats a zero request against a zero balance as SAFE', () => {
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: '0',
      walletTokenBalance: '0',
      tokenDecimals: 9,
    });
    expect(result.level).toBe('SAFE');
  });

  it('includes human-readable amounts in the reasoning text', () => {
    const result = evaluateApprovalRisk({
      requestedApprovalAmount: (50n * 10n ** 9n).toString(),
      walletTokenBalance: (1n * 10n ** 9n).toString(),
      tokenDecimals: 9,
    });
    expect(result.reasoning).toContain('50');
    expect(result.reasoning).toContain('1');
  });
});
