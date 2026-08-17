/**
 * Adapts Sprint 8's real exitability alert-event generator
 * (`buildExitabilityAlertEvents`) into webhook-shaped events.
 *
 * This is the one domain wired end-to-end to webhook delivery this sprint
 * (see `lib/alerts/dispatch.ts`) — `lib/activity/alert-events.ts` and
 * `lib/portfolio/alert-events.ts` produce real alert events too but aren't
 * bridged to delivery yet, kept out of scope to bound this sprint (the
 * pattern below generalizes to them without a redesign).
 */

import type { ExitabilityAlertEvent } from '@/lib/exitability/types';
import type { WebhookEvent } from './dispatcher';
import type { WebhookEventType } from './store';
import { generateId } from '@/lib/server/id';

const EXITABILITY_TO_WEBHOOK_EVENT: Record<ExitabilityAlertEvent['type'], WebhookEventType> = {
  EXITABILITY_DROP: 'token.exitability_dropped',
  LIQUIDITY_DROP: 'token.liquidity_changed',
  LARGE_LIQUIDITY_WITHDRAWAL: 'token.liquidity_changed',
  EXIT_DEPTH_COLLAPSE: 'token.liquidity_changed',
  SLIPPAGE_SPIKE: 'token.risk_changed',
  POOL_CONCENTRATION_CHANGE: 'token.risk_changed',
  STRESS_EXITABILITY_DROP: 'token.exitability_dropped',
};

export function exitabilityAlertToWebhookEvent(alert: ExitabilityAlertEvent): WebhookEvent {
  return {
    eventId: generateId('evt'),
    eventType: EXITABILITY_TO_WEBHOOK_EVENT[alert.type],
    payload: {
      type: alert.type,
      tokenId: alert.tokenId,
      chain: alert.chain,
      severity: alert.severity,
      title: alert.title,
      confidence: alert.confidence,
      metadata: alert.metadata,
      occurredAt: alert.occurredAt,
    },
  };
}
