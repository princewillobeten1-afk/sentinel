import { describe, it, expect } from 'vitest';
import { AdminActionSimulator } from '../simulator';

describe('Admin Action Simulator Engine (Sprint 39 §78)', () => {
  it('simulates fee reduction: models volume stimulation and revenue delta', () => {
    const sim = AdminActionSimulator.simulateFeeChange({
      currentFeePct: 0.5,
      proposedFeePct: 0.35,
      baseline24hVolumeUsd: 84_200_000,
    });

    expect(sim.actionType).toBe('FEE_RATE_CHANGE');
    expect(sim.currentState.tradingFeePct).toBe(0.5);
    expect(sim.proposedState.tradingFeePct).toBe(0.35);
    expect(sim.estimatedImpact.volumeChangePct).toBeGreaterThan(0); // Price elasticity stimulates volume
    expect(sim.estimatedImpact.summary).toContain('revenue');
  });

  it('generates high fee warning when proposed fee exceeds 1.0%', () => {
    const sim = AdminActionSimulator.simulateFeeChange({
      currentFeePct: 0.5,
      proposedFeePct: 1.5,
    });

    expect(sim.warnings.length).toBeGreaterThan(0);
    expect(sim.warnings[0]).toContain('High Fee Warning');
  });

  it('simulates emergency escalation and projects affected users count', () => {
    const sim = AdminActionSimulator.simulateEmergencyEscalation({
      currentMode: 'NORMAL',
      proposedMode: 'FULL_EMERGENCY',
    });

    expect(sim.estimatedImpact.liquidityStressRisk).toBe('HIGH');
    expect(sim.estimatedImpact.volumeChangePct).toBe(-100);
    expect(sim.warnings.length).toBeGreaterThan(0);
  });
});
