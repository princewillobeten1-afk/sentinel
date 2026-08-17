import { describe, it, expect } from 'vitest';
import { AdminAiInvestigationAssistant } from '../ai-assistant';

describe('AI Investigation Assistant & Evidence Traceability (Sprint 39 §82-83)', () => {
  it('synthesizes operational briefings and chronological event breakdowns', async () => {
    const res = await AdminAiInvestigationAssistant.analyze('Summarize recent market activities on $SENT');

    expect(res.headline).toBeDefined();
    expect(res.verdict).toBe('CLEAN');
    expect(res.confidenceScorePct).toBeGreaterThan(90);
    expect(res.chronologicalBreakdown.length).toBeGreaterThan(0);
    expect(res.evidenceCitations.length).toBeGreaterThan(0);
    expect(res.isAdvisoryOnly).toBe(true);
  });

  it('detects and anchors evidence to verified on-chain citations for suspicious tokens', async () => {
    const res = await AdminAiInvestigationAssistant.analyze('Check sniper wallet activity on $SOLM', '9pW2...8b11');

    expect(res.verdict).toBe('CRITICAL_THREAT');
    expect(res.detectedAnomalies.length).toBeGreaterThan(0);
    expect(res.evidenceCitations.some((c) => c.type === 'CLUSTER')).toBe(true);
    expect(res.evidenceCitations.every((c) => c.verified)).toBe(true);
    expect(res.recommendedSteps).toContain('Add RESTRICTED warning badge on token page to alert retail users');
  });
});
