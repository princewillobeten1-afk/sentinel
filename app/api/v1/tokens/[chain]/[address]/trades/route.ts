import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/trades — retired.
 *
 * This proxied Birdeye, whose compute-unit quota is exhausted, and on failure
 * returned a hardcoded tape: six trades at `$0.0425` from wallets like
 * `4zW8...9kL2` with invented signatures such as `5xQ98j1k2mP3`. Those rows
 * rendered on real token pages styled identically to captured trades.
 *
 * The tape now lives at `/live-trades`, which reads `realtime_trades` — the
 * trades this platform actually captured, each with a bare on-chain signature
 * that resolves on an explorer.
 *
 * It answers 410 rather than being deleted outright so an older client gets a
 * clear reason instead of a 404, and so nothing silently falls back to fiction.
 */
export async function GET(
  _request: Request,
  { params }: { params: { chain: string; address: string } },
) {
  try {
    throw new ApiError(
      `This endpoint served placeholder trades and has been retired. Use ` +
        `/api/v1/tokens/${params.chain}/${params.address}/live-trades instead.`,
      410,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Retired endpoint', 410));
  }
}
