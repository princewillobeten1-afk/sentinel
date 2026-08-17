import { describe, it, expect } from 'vitest';
import { generateReport } from '../report-generator';
import { getMockReportInput } from '@/lib/mocks/intelligence';

describe('Token Intelligence Report Generator', () => {
  it('generates a complete, structured report for SENT token', () => {
    const input = getMockReportInput('SENT');
    expect(input).toBeDefined();

    const report = generateReport(input!);

    expect(report.token.symbol).toBe('SENT');
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.riskLevel).toBeDefined();
    expect(report.confidence.score).toBeGreaterThan(0);
    expect(report.dataFreshness).toBeDefined();
    expect(report.methodologyVersion).toContain('sentinel-intelligence');
    expect(report.explanation).toContain('SENT');

    // Verify 7 dimensions exist
    const categories = ['MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT'];
    for (const cat of categories) {
      expect((report.riskDimensions as any)[cat]).toBeDefined();
    }
  });

  // ── Scenario 7: Stale data ──
  it('Scenario 7 — Stale data decreases confidence appropriately', () => {
    const input = getMockReportInput('SENT');
    expect(input).toBeDefined();

    const staleTime = new Date(Date.now() - 1200_000).toISOString(); // 20 mins ago (stale)
    const staleInput = {
      ...input!,
      market: { ...input!.market!, dataTimestamp: staleTime },
      liquidity: { ...input!.liquidity!, dataTimestamp: staleTime },
    };

    const freshReport = generateReport(input!);
    const staleReport = generateReport(staleInput);

    expect(staleReport.confidence.score).toBeLessThan(freshReport.confidence.score);
    expect(staleReport.dataFreshness.overall).not.toBe('CURRENT');
  });

  // ── Scenario 9: Historical report reproducibility ──
  it('Scenario 9 — Report output is deterministic for identical input data', () => {
    const input = getMockReportInput('SENT');
    expect(input).toBeDefined();

    const report1 = generateReport(input!);
    const report2 = generateReport(input!);

    expect(report1.overallScore).toBe(report2.overallScore);
    expect(report1.riskLevel).toBe(report2.riskLevel);
    expect(report1.confidence.score).toBe(report2.confidence.score);
    expect(report1.signals.length).toBe(report2.signals.length);
  });
});
