import { jsonResponse, errorResponse } from '@/lib/server/api';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ApiError } from '@/lib/server/errors';
import { getSolanaSwapStatus, swapReceipt } from '@/lib/trading/solana-swap-service';
import { checkRateLimit } from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';
export const GET = withApiGateway(async (ctx, _request, params) => {
  try {
    checkRateLimit(`swap-status:${ctx.user.userId}`, 60, 60_000);
    return jsonResponse(swapReceipt(await getSolanaSwapStatus(ctx.user.userId, params.preparedId)), 200, { 'Cache-Control': 'no-store' });
  } catch (error) { return errorResponse(error instanceof ApiError ? error : new ApiError('Transaction status is unavailable. Do not create a replacement trade yet.', 503, 'STATUS_UNAVAILABLE')); }
}, { scopes: ['TRADE'], allowSessionAuth: true });
