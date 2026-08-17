import { describe, it, expect } from 'vitest';
import { intelligencePipeline } from '../pipeline';
import { intelligenceStore } from '../store';
import { getMockReportInput } from '@/lib/mocks/intelligence';

describe('Intelligence Pipeline & Store', () => {
  // ── Scenario 8: Duplicate event ──
  it('Scenario 8 — Duplicate events are ignored and not processed twice', () => {
    const input = getMockReportInput('SENT');
    expect(input).toBeDefined();

    const eventId = 'test_event_dup_123';
    const initialMetrics = intelligencePipeline.getMetrics();

    intelligencePipeline.scheduleUpdate('dt_sentinel', input!, eventId);
    intelligencePipeline.scheduleUpdate('dt_sentinel', input!, eventId); // Duplicate

    const newMetrics = intelligencePipeline.getMetrics();
    expect(newMetrics.processedEvents - initialMetrics.processedEvents).toBe(1);
  });

  // ── Scenario 10: Intelligence update ──
  it('Scenario 10 — Processing an update updates cache, records snapshot and timeline event', () => {
    const input = getMockReportInput('SENT');
    expect(input).toBeDefined();

    const report = intelligencePipeline.processImmediate('dt_sentinel', input!);

    expect(report).toBeDefined();
    expect(intelligenceStore.getCurrentReport('dt_sentinel')).toBeDefined();

    const snapshots = intelligenceStore.getSnapshots('dt_sentinel');
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1].overallScore).toBe(report.overallScore);
  });

  it('Store caches and invalidates correctly', () => {
    const input = getMockReportInput('QUANT');
    expect(input).toBeDefined();

    intelligencePipeline.processImmediate('dt_quantum', input!);

    expect(intelligenceStore.getCurrentReport('dt_quantum')).toBeDefined();
    expect(intelligenceStore.isCacheFresh('dt_quantum')).toBe(true);

    intelligenceStore.invalidateReport('dt_quantum');
    expect(intelligenceStore.getCurrentReport('dt_quantum')).toBeNull();
  });
});
