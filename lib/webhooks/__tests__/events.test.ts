import { describe, expect, it } from 'vitest';
import { exitabilityAlertToWebhookEvent } from '../events';
import type { ExitabilityAlertEvent } from '@/lib/exitability/types';

function buildAlert(overrides: Partial<ExitabilityAlertEvent> = {}): ExitabilityAlertEvent {
  return {
    type: 'EXITABILITY_DROP',
    tokenId: 'token_sent',
    chain: 'solana',
    severity: 'critical',
    title: 'Exitability dropped from 80 to 55',
    evidence: [],
    confidence: 0.9,
    metadata: { previousScore: 80, currentScore: 55 },
    occurredAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('exitabilityAlertToWebhookEvent', () => {
  it.each([
    ['EXITABILITY_DROP', 'token.exitability_dropped'],
    ['STRESS_EXITABILITY_DROP', 'token.exitability_dropped'],
    ['LIQUIDITY_DROP', 'token.liquidity_changed'],
    ['LARGE_LIQUIDITY_WITHDRAWAL', 'token.liquidity_changed'],
    ['EXIT_DEPTH_COLLAPSE', 'token.liquidity_changed'],
    ['SLIPPAGE_SPIKE', 'token.risk_changed'],
    ['POOL_CONCENTRATION_CHANGE', 'token.risk_changed'],
  ] as const)('maps %s to %s', (type, expectedEventType) => {
    const result = exitabilityAlertToWebhookEvent(buildAlert({ type }));
    expect(result.eventType).toBe(expectedEventType);
  });

  it('carries alert fields through into the payload', () => {
    const alert = buildAlert({ severity: 'warning', title: 'Liquidity declined 42%' });
    const result = exitabilityAlertToWebhookEvent(alert);

    expect(result.payload).toMatchObject({
      type: alert.type,
      tokenId: alert.tokenId,
      chain: alert.chain,
      severity: 'warning',
      title: 'Liquidity declined 42%',
      confidence: alert.confidence,
      occurredAt: alert.occurredAt,
    });
  });

  it('generates a unique eventId per call, even for identical alerts', () => {
    const alert = buildAlert();
    const first = exitabilityAlertToWebhookEvent(alert);
    const second = exitabilityAlertToWebhookEvent(alert);
    expect(first.eventId).not.toBe(second.eventId);
  });
});
