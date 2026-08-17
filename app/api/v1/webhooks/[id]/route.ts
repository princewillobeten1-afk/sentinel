import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { webhookStore } from '@/lib/webhooks/store';

export const dynamic = 'force-dynamic';

/** GET /api/v1/webhooks/:id — webhook detail plus its recent delivery attempts. */
export const GET = withApiGateway(
  async (ctx, _request, params) => {
    try {
      const webhook = webhookStore.getForUser(params.id, ctx.user.userId);
      if (!webhook) throw new ApiError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');

      return jsonResponse({ webhook, deliveries: webhookStore.listDeliveriesForWebhook(webhook.id).slice(0, 50) });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to load webhook', 500));
    }
  },
  { scopes: ['MANAGE_WEBHOOKS'], allowSessionAuth: true },
);

/** DELETE /api/v1/webhooks/:id */
export const DELETE = withApiGateway(
  async (ctx, _request, params) => {
    try {
      const deleted = webhookStore.delete(params.id, ctx.user.userId);
      if (!deleted) throw new ApiError('Webhook not found', 404, 'WEBHOOK_NOT_FOUND');
      return jsonResponse({ deleted: true, id: params.id });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to delete webhook', 500));
    }
  },
  { scopes: ['MANAGE_WEBHOOKS'], allowSessionAuth: true },
);
