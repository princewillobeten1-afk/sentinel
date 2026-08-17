import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { withApiGateway } from '@/lib/server/api-gateway';
import { webhookStore } from '@/lib/webhooks/store';

export const dynamic = 'force-dynamic';

const EVENT_TYPES = [
  'token.risk_changed',
  'token.insider_detected',
  'token.liquidity_changed',
  'token.exitability_dropped',
  'wallet.activity',
  'launch.created',
  'launch.graduated',
  'order.filled',
  'order.failed',
] as const;

const createWebhookSchema = z.object({
  url: z.string().url('A valid https URL is required'),
  eventTypes: z.array(z.enum(EVENT_TYPES)).min(1, 'Subscribe to at least one event type'),
});

/** GET /api/v1/webhooks — list this account's webhooks. */
export const GET = withApiGateway(
  async (ctx) => {
    const webhooks = webhookStore.listForUser(ctx.user.userId);
    return jsonResponse({ webhooks, count: webhooks.length });
  },
  { scopes: ['MANAGE_WEBHOOKS'], allowSessionAuth: true },
);

/**
 * POST /api/v1/webhooks — create a subscription.
 *
 * The signing secret is returned exactly once here and never again (same
 * one-time-display contract as API keys, spec §9). `idempotent: true` so a
 * retried create doesn't leave a duplicate subscription behind.
 */
export const POST = withApiGateway(
  async (ctx, request) => {
    try {
      const payload = await parseJsonBody(request);
      const data = validateSchema(createWebhookSchema, payload);

      if (!data.url.startsWith('https://') && !data.url.startsWith('http://localhost')) {
        throw new ApiError('Webhook URL must use https (http is allowed only for localhost testing).', 400, 'INSECURE_WEBHOOK_URL');
      }

      const { webhook, secret } = webhookStore.create(ctx.user.userId, {
        url: data.url,
        eventTypes: [...data.eventTypes],
      });

      return jsonResponse(
        {
          webhook,
          secret,
          notice: 'Store this signing secret now — it is shown only once and cannot be retrieved later.',
        },
        201,
      );
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to create webhook', 500));
    }
  },
  { scopes: ['MANAGE_WEBHOOKS'], allowSessionAuth: true, idempotent: true },
);
