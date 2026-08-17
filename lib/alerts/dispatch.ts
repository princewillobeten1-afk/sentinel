/**
 * Bridges the exitability pipeline's real alert-event generator
 * (`buildExitabilityAlertEvents`, computed inside `processExitabilityPipeline`)
 * to webhook delivery. A webhook's own `eventTypes` list (set at creation,
 * see `lib/webhooks/store.ts`) already is the subscription — there's no
 * separate subscription entity to manage here, just adapt-and-broadcast.
 *
 * Called from `app/api/v1/exitability/[chain]/[token]/route.ts` after each
 * pipeline run. `lib/activity/alert-events.ts` and `lib/portfolio/alert-events.ts`
 * produce real alert events too but aren't bridged this sprint — the pattern
 * below generalizes to them without a redesign.
 */

import 'server-only';

import type { ExitabilityAlertEvent } from '@/lib/exitability/types';
import { exitabilityAlertToWebhookEvent } from '@/lib/webhooks/events';
import { broadcastEvent } from '@/lib/webhooks/dispatcher';

export function dispatchExitabilityAlerts(alerts: ExitabilityAlertEvent[]): void {
  for (const alert of alerts) {
    broadcastEvent(exitabilityAlertToWebhookEvent(alert));
  }
}
