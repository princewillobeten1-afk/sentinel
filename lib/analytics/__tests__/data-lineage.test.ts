import { describe, it, expect } from 'vitest';
import { DataLineageTracer } from '../data-lineage';

describe('Bidirectional Data Lineage & Provenance (Sprint 38 §7)', () => {
  it('generates a full trace from high-level insight back to raw block and transaction', () => {
    const trace = DataLineageTracer.traceScoreLineage({
      insightId: 'ins_exit_01',
      scoreName: 'Exitability Score',
      computedScore: 42,
      tokenAddress: 'TokenTraceTest111',
      rootBlockNumber: 295000100,
      rootTxHash: '0xabc123...traceRoot',
    });

    expect(trace.verified).toBe(true);
    expect(trace.lineagePath.length).toBe(7);

    const layers = trace.lineagePath.map((p) => p.layer);
    expect(layers).toContain('INSIGHT');
    expect(layers).toContain('SCORE');
    expect(layers).toContain('SIGNAL');
    expect(layers).toContain('METRIC');
    expect(layers).toContain('NORMALIZED_EVENT');
    expect(layers).toContain('TRANSACTION');
    expect(layers).toContain('RAW_BLOCK');
  });
});
