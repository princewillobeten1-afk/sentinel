/**
 * In-process webhook delivery queue (Sprint 28 §45-49).
 *
 * No real queue infra (Redis/SQS/etc.) — a `setInterval` poll over
 * `webhookStore`'s pending deliveries, consistent with this sprint's
 * in-memory persistence decision. Explicitly documented limitation: retries
 * do not survive a process restart, since the queue itself is in-memory.
 * That's a real gap for a production webhook system and is stated here
 * rather than hidden — durable delivery needs a real queue + DB behind it,
 * which is out of scope for this pass (see the sprint plan's persistence
 * decision).
 */

import 'server-only';

import { logger } from '@/lib/server/logger';
import { generateId } from '@/lib/server/id';
import { webhookStore, type Webhook, type WebhookDelivery, type WebhookEventType } from './store';
import { buildSignedHeaders } from './signing';

/** 1m, 5m, 30m, 2h — matches the spec's exponential-backoff intent without over-engineering a full jittered scheme for a demo-scale in-memory queue. */
const BACKOFF_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length + 1;
const POLL_INTERVAL_MS = 5_000;
const DELIVERY_TIMEOUT_MS = 10_000;

export interface WebhookEvent {
  eventId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}

/** Enqueues a delivery for one webhook. Deduped per (webhook, event) pair, not globally — the same event legitimately fans out to every matching subscriber. */
export function enqueueDelivery(webhook: Webhook, event: WebhookEvent): void {
  const dedupeKey = `${webhook.id}:${event.eventId}`;
  if (webhookStore.hasSeenEvent(dedupeKey)) return;
  webhookStore.markEventSeen(dedupeKey);

  const delivery: WebhookDelivery = {
    id: generateId('whd'),
    webhookId: webhook.id,
    eventId: event.eventId,
    eventType: event.eventType,
    payload: event.payload,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: new Date().toISOString(),
    responseStatus: null,
    createdAt: new Date().toISOString(),
  };

  webhookStore.recordDelivery(delivery);
}

/** Fans an event out to every active webhook subscribed to its type. */
export function broadcastEvent(event: WebhookEvent): void {
  const subscribers = webhookStore.listActiveSubscribers(event.eventType);
  for (const webhook of subscribers) {
    enqueueDelivery(webhook, event);
  }
}

async function attemptDelivery(delivery: WebhookDelivery): Promise<void> {
  const webhook = webhookStore.getStoredForDelivery(delivery.webhookId);
  if (!webhook || webhook.status !== 'active') {
    webhookStore.updateDelivery(delivery.id, { status: 'exhausted' });
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const headers = buildSignedHeaders(webhook.secret, delivery.eventId, body);
  const attempts = delivery.attempts + 1;
  const now = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (response.ok) {
      webhookStore.updateDelivery(delivery.id, {
        status: 'delivered',
        attempts,
        lastAttemptAt: now,
        nextAttemptAt: null,
        responseStatus: response.status,
      });
      return;
    }

    scheduleRetryOrExhaust(delivery.id, attempts, now, response.status);
  } catch (err) {
    logger.warn('[webhooks] delivery attempt failed', {
      webhookId: webhook.id,
      eventId: delivery.eventId,
      attempt: attempts,
      message: err instanceof Error ? err.message : String(err),
    });
    scheduleRetryOrExhaust(delivery.id, attempts, now, null);
  }
}

function scheduleRetryOrExhaust(deliveryId: string, attempts: number, lastAttemptAt: string, responseStatus: number | null): void {
  if (attempts >= MAX_ATTEMPTS) {
    webhookStore.updateDelivery(deliveryId, { status: 'exhausted', attempts, lastAttemptAt, nextAttemptAt: null, responseStatus });
    return;
  }

  const delayMs = BACKOFF_SCHEDULE_MS[attempts - 1] ?? BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
  webhookStore.updateDelivery(deliveryId, {
    status: 'pending',
    attempts,
    lastAttemptAt,
    nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
    responseStatus,
  });
}

class WebhookDispatcher {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    logger.info('[webhooks] dispatcher started', { pollIntervalMs: POLL_INTERVAL_MS });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const due = webhookStore.listPendingDeliveries();
    for (const delivery of due) {
      void attemptDelivery(delivery);
    }
  }
}

const globalForDispatcher = globalThis as unknown as { webhookDispatcher?: WebhookDispatcher };
export const webhookDispatcher = globalForDispatcher.webhookDispatcher ?? new WebhookDispatcher();
if (process.env.NODE_ENV !== 'production') globalForDispatcher.webhookDispatcher = webhookDispatcher;
