// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuditPills } from '@/components/ui/audit-pills';
import { SecurityPills } from '@/components/ui/security-pills';
import { RugRiskPill } from '@/components/ui/rug-risk-pill';
import type { MetricEvidence, RugRiskEvidence } from '../types';

// Test pill semantics, not the tooltip's layout/portal measurement.
vi.mock('@/components/ui/legend-tooltip', () => ({ LegendTooltip: ({ children }: { children: React.ReactNode }) => children }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
const green = (root: HTMLElement) => root.querySelectorAll('.text-emerald-400').length;
const risk: RugRiskEvidence = { score: 0, level: 'low', completeness: 'complete', factors: [], version: 'test' };
const measured = (): MetricEvidence => ({ status: 'measured', source: 'test', observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1_000).toISOString() });

it('does not color values green without provenance or after a provider failure', () => {
  const { container, rerender } = render(React.createElement(AuditPills, { top10HoldingsPct: 5, alwaysShow: true }));
  expect(green(container)).toBe(0);
  rerender(React.createElement(AuditPills, { top10HoldingsPct: 5, evidence: measured() }));
  expect(green(container)).toBe(1);
  rerender(React.createElement(AuditPills, { top10HoldingsPct: 5, evidence: { ...measured(), status: 'unavailable' } }));
  expect(green(container)).toBe(0);
});

it('expires audit and security pills even without another stream event', async () => {
  vi.useFakeTimers();
  const evidence = measured();
  const { container } = render(React.createElement(React.Fragment, null,
    React.createElement(AuditPills, { top10HoldingsPct: 5, evidence }),
    React.createElement(SecurityPills, { isMintRenounced: true, evidence })));
  expect(green(container)).toBe(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
  expect(green(container)).toBe(0);
});

it('downgrades a complete low risk score when liquidity evidence expires', async () => {
  vi.useFakeTimers();
  const evidence = measured();
  const { container } = render(React.createElement(RugRiskPill, { risk, ownershipEvidence: { ...evidence, expiresAt: undefined },
    securityEvidence: { ...evidence, expiresAt: undefined }, liquidityEvidence: evidence }));
  expect(green(container)).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
  expect(green(container)).toBe(0);
  expect(container.textContent).toContain('stale');
});

it('does not display a reassuring zero while the risk assessment is partial', () => {
  const { container } = render(React.createElement(RugRiskPill, {
    risk: { ...risk, completeness: 'partial' }, securityEvidence: measured(),
  }));
  expect(container.textContent).toContain('Risk pending');
  expect(container.textContent).not.toContain('Risk 0');
});
