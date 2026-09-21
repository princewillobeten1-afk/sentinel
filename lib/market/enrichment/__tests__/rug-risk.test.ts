import { describe, expect, it } from 'vitest';
import { calculateRugRisk, RUG_RISK_VERSION } from '../rug-risk';

describe('evidence risk completeness', () => {
  it('returns no score without valid measured evidence', () => {
    expect(calculateRugRisk({})).toBeNull();
    expect(calculateRugRisk({ top10Pct: NaN, devPct: -1, snipersPct: 101 })).toBeNull();
  });

  it('never labels a sparse zero as complete', () => {
    expect(calculateRugRisk({ top10Pct: 0 })).toMatchObject({ score: 0, completeness: 'partial' });
  });

  it('requires every defined scoring input for completeness', () => {
    const evidence = { top10Pct: 0, devPct: 0, snipersPct: 0, insidersPct: 0, bundlersPct: 0,
      mintAuthorityRevoked: true, freezeAuthorityRevoked: true, liquidityLocked: true };
    expect(calculateRugRisk(evidence)).toMatchObject({ score: 0, completeness: 'complete', version: RUG_RISK_VERSION });
    expect(calculateRugRisk({ ...evidence, liquidityLocked: undefined })?.completeness).toBe('partial');
    expect(calculateRugRisk({ ...evidence, mintAuthorityRevoked: false })?.score).toBe(20);
    expect(calculateRugRisk(evidence)).toEqual(calculateRugRisk(evidence));
  });
});
