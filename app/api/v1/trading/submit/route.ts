import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ApiError } from '@/lib/server/errors';
import { recordAuditEvent } from '@/lib/server/audit';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { submitSolanaSwap, swapReceipt } from '@/lib/trading/solana-swap-service';

export const dynamic = 'force-dynamic';
const schema = z.object({ preparedId: z.string().uuid(), signedTransaction: z.string().min(1).max(1644),
  idempotencyKey: z.string().min(8).max(200) });
export const POST = withApiGateway(async (ctx, request) => {
  try {
    if (ctx.apiKey?.environment === 'sandbox') throw new ApiError('Sandbox keys cannot submit mainnet swaps.', 403, 'SANDBOX_TRADING_DISABLED');
    checkRateLimit(`swap-submit:${ctx.user.userId}`, 20, 60_000);
    const input = validateSchema(schema, await parseJsonBody(request));
    const swap = await submitSolanaSwap(ctx.user.userId, input);
    recordAuditEvent({ userId: ctx.user.userId, action: 'TRADE_SUBMITTED', entityType: 'transaction',
      entityId: swap.id, changes: { txSignature: swap.signature, status: swap.status, network: swap.network } });
    return jsonResponse(swapReceipt(swap), swap.status === 'pending' ? 202 : 200);
  } catch (error) {
    return errorResponse(error instanceof ApiError ? error : new ApiError('Submission could not be completed. Check the prepared trade status before retrying.', 503, 'SUBMISSION_UNAVAILABLE'));
  }
}, { scopes: ['TRADE'], allowSessionAuth: true });
