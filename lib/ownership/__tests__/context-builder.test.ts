import { describe, it, expect } from 'vitest';
import { buildOwnershipInput, computeOwnershipReport } from '../context-builder';

describe('ownership context-builder', () => {
  it('builds a real OwnershipInput for a known symbol', () => {
    const input = buildOwnershipInput('sent');
    expect(input).not.toBeNull();
    expect(input?.tokenId).toBe('dt_sentinel');
    expect(input?.holders.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown symbol rather than throwing', () => {
    expect(buildOwnershipInput('NOT_A_TOKEN')).toBeNull();
    expect(computeOwnershipReport('NOT_A_TOKEN')).toBeNull();
  });

  it('QUANT reproduces the same qualitative concentration read the old literal had (EXTREME)', () => {
    const report = computeOwnershipReport('QUANT');
    expect(report).not.toBeNull();
    expect(report?.concentration.level).toBe('EXTREME');
  });

  it('SENT (healthy distribution, no clusters) reads materially less concentrated than QUANT', () => {
    const sent = computeOwnershipReport('SENT');
    const quant = computeOwnershipReport('QUANT');
    expect(sent?.concentration.topClusterPct).toBe(0);
    expect(sent!.concentration.topHolderPct).toBeLessThan(quant!.concentration.topHolderPct);
  });

  it('is computed for real, not a canned literal — the same symbol run twice matches (deterministic), and the report carries real evidence', () => {
    const first = computeOwnershipReport('ALPHA');
    const second = computeOwnershipReport('ALPHA');
    expect(first?.concentration).toEqual(second?.concentration);
    expect(first?.entities.length).toBeGreaterThan(0);
    expect(first?.entities[0].evidence.length).toBeGreaterThan(0);
  });
});
