/**
 * Webhook subscription + delivery storage (Sprint 28 §45-49).
 *
 * In-memory, `globalThis`-guarded — same pattern as `lib/server/api-keys.ts`
 * and `lib/server/store.ts`. Retries only survive within the running
 * process; stated plainly here rather than implied to be durable.
 */

import { generateId } from '@/lib/server/id';
import { generateWebhookSecret } from './signing';

export type WebhookStatus = 'active' | 'disabled';
export type WebhookEventType =
  | 'token.risk_changed'
  | 'token.insider_detected'
  | 'token.liquidity_changed'
  | 'token.exitability_dropped'
  | 'wallet.activity'
  | 'launch.created'
  | 'launch.graduated'
  | 'order.filled'
  | 'order.failed';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  eventTypes: WebhookEventType[];
  status: WebhookStatus;
  createdAt: string;
  updatedAt: string;
}

interface StoredWebhook extends Webhook {
  secret: string;
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'exhausted';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  responseStatus: number | null;
  createdAt: string;
}

export interface CreateWebhookInput {
  url: string;
  eventTypes: WebhookEventType[];
}

class WebhookStore {
  private webhooksById = new Map<string, StoredWebhook>();
  private deliveriesById = new Map<string, WebhookDelivery>();
  /** Replay protection: every eventId ever delivered, so a duplicate upstream event never double-fires. */
  private seenEventIds = new Set<string>();

  create(userId: string, input: CreateWebhookInput): { webhook: Webhook; secret: string } {
    const now = new Date().toISOString();
    const secret = generateWebhookSecret();
    const stored: StoredWebhook = {
      id: generateId('wh'),
      userId,
      url: input.url,
      eventTypes: input.eventTypes,
      status: 'active',
      secret,
      createdAt: now,
      updatedAt: now,
    };
    this.webhooksById.set(stored.id, stored);
    return { webhook: toPublicWebhook(stored), secret };
  }

  listForUser(userId: string): Webhook[] {
    return [...this.webhooksById.values()]
      .filter((webhook) => webhook.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toPublicWebhook);
  }

  getForUser(webhookId: string, userId: string): Webhook | null {
    const stored = this.webhooksById.get(webhookId);
    if (!stored || stored.userId !== userId) return null;
    return toPublicWebhook(stored);
  }

  /** Internal-only accessor (includes secret) — never returned from a route handler directly. */
  getStoredForDelivery(webhookId: string): StoredWebhook | null {
    return this.webhooksById.get(webhookId) ?? null;
  }

  listActiveSubscribers(eventType: WebhookEventType): StoredWebhook[] {
    return [...this.webhooksById.values()].filter(
      (webhook) => webhook.status === 'active' && webhook.eventTypes.includes(eventType),
    );
  }

  delete(webhookId: string, userId: string): boolean {
    const stored = this.webhooksById.get(webhookId);
    if (!stored || stored.userId !== userId) return false;
    return this.webhooksById.delete(webhookId);
  }

  // ── Deliveries ──

  recordDelivery(delivery: WebhookDelivery): void {
    this.deliveriesById.set(delivery.id, delivery);
  }

  updateDelivery(deliveryId: string, patch: Partial<WebhookDelivery>): void {
    const existing = this.deliveriesById.get(deliveryId);
    if (!existing) return;
    this.deliveriesById.set(deliveryId, { ...existing, ...patch });
  }

  listPendingDeliveries(): WebhookDelivery[] {
    const now = Date.now();
    return [...this.deliveriesById.values()].filter(
      (delivery) => delivery.status === 'pending' && (!delivery.nextAttemptAt || Date.parse(delivery.nextAttemptAt) <= now),
    );
  }

  listDeliveriesForWebhook(webhookId: string): WebhookDelivery[] {
    return [...this.deliveriesById.values()]
      .filter((delivery) => delivery.webhookId === webhookId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  // ── Replay protection ──

  hasSeenEvent(eventId: string): boolean {
    return this.seenEventIds.has(eventId);
  }

  markEventSeen(eventId: string): void {
    this.seenEventIds.add(eventId);
    // Bounded — this is a demo-scale in-memory set, not a durable ledger.
    if (this.seenEventIds.size > 100_000) {
      const [first] = this.seenEventIds;
      this.seenEventIds.delete(first);
    }
  }
}

function toPublicWebhook(stored: StoredWebhook): Webhook {
  const { secret: _secret, ...publicWebhook } = stored;
  return publicWebhook;
}

// Survives Next.js dev-mode HMR reloads — matches lib/server/store.ts's pattern.
const globalForWebhooks = globalThis as unknown as { webhookStore?: WebhookStore };
export const webhookStore = globalForWebhooks.webhookStore ?? new WebhookStore();
if (process.env.NODE_ENV !== 'production') globalForWebhooks.webhookStore = webhookStore;
