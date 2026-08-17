import type { SentinelClient } from '../client';

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
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed' | 'exhausted';
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  responseStatus: number | null;
  createdAt: string;
}

export interface CreateWebhookResult {
  webhook: Webhook;
  /** Shown exactly once — store it now, it cannot be retrieved again. Use it to verify `X-Sentinel-Signature`. */
  secret: string;
  notice: string;
}

/**
 * Webhooks — HMAC-signed event delivery (`app/api/v1/webhooks/**`). Requires
 * `MANAGE_WEBHOOKS`. Verify inbound deliveries by recomputing
 * `HMAC-SHA256(secret, "${timestamp}.${eventId}.${rawBody}")` and comparing
 * to the `X-Sentinel-Signature` header (see `lib/webhooks/signing.ts`).
 */
export class WebhooksResource {
  constructor(private readonly client: SentinelClient) {}

  list(): Promise<{ webhooks: Webhook[]; count: number }> {
    return this.client.get('/api/v1/webhooks');
  }

  create(url: string, eventTypes: WebhookEventType[], idempotencyKey?: string): Promise<CreateWebhookResult> {
    return this.client.post('/api/v1/webhooks', { url, eventTypes }, { idempotencyKey });
  }

  get(id: string): Promise<{ webhook: Webhook; deliveries: WebhookDelivery[] }> {
    return this.client.get(`/api/v1/webhooks/${id}`);
  }

  delete(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.client.delete(`/api/v1/webhooks/${id}`);
  }

  /** Queues a synthetic test event so you can verify your receiver handles signing/delivery correctly. */
  test(id: string): Promise<Record<string, unknown>> {
    return this.client.post(`/api/v1/webhooks/${id}/test`);
  }
}
