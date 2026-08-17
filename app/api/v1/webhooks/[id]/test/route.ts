import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { webhookStore } from '@/lib/webhooks/store';
import { enqueueDelivery, webhookDispatcher } from '@/lib/webhooks/dispatcher';
import { generateId } from '@/lib/server/id';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/webhooks/:id/test (Sprint 28 §72)
 *
 * Sends a synthetic, clearly-labeled event to the endpoint so a developer
 * can verify their signature-verification code against a real signed
 * request before depending on live traffic.
 */
export const POST = withApiGateway(
  async (ctx, _request, params) => {
    try {
      const webhook = webhookStore.getForUser(params.id, ctx.user.userId);
      if (!webhook) throw new ApiError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');

      webhookDispatcher.start();

      const eventId = generateId('evt');
      enqueueDelivery(webhook, {
        eventId,
        eventType: webhook.eventTypes[0],
        payload: {
          test: true,
          message: 'This is a Sentinel test event. It carries the same signature headers as a real delivery.',
          webhookId: webhook.id,
          sentAt: new Date().toISOString(),
        },
      });

      return jsonResponse({
        queued: true,
        eventId,
        note: 'Delivery is queued and attempted asynchronously. Poll GET /api/v1/webhooks/:id to see the attempt result.',
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to queue test event', 500));
    }
  },
  { scopes: ['MANAGE_WEBHOOKS'], allowSessionAuth: true },
);
