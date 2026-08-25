import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { marketStreamManager } from '@/lib/market/live/stream-manager';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/market/live/focus
 *
 * Aims the live stream at a single token, or releases it.
 *
 * Body: `{ mint: string }` to focus, `{ mint: null }` to resume the sweep.
 *
 * ## Why focusing exists
 *
 * Enrichment is capped at a small number of RPC calls per second (measured as
 * this plan's ceiling — see `transaction-enricher.ts`). That budget cannot
 * simultaneously sweep every DEX program and keep pace with one token's trade
 * tape. A token page that wants a live tape therefore *takes* the budget:
 * the broad program subscriptions are dropped and replaced with a single
 * `mentions:[mint]` subscription.
 *
 * The cost is real and deliberate: while focused, market-wide capture is
 * paused. `GET /api/v1/market/live/status` reports `focusedMint` so this is
 * observable rather than something a quiet feed leaves you to infer.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { mint?: unknown } | null;
    const mint = body?.mint;

    if (mint === null || mint === undefined || mint === '') {
      marketStreamManager.clearFocus();
      return jsonResponse({ focusedMint: null, marketWideCapture: 'resumed' });
    }

    if (typeof mint !== 'string' || mint.length < 32 || mint.length > 64) {
      throw new ApiError('mint must be a Solana mint address', 400);
    }

    marketStreamManager.focusMint(mint);
    return jsonResponse({
      focusedMint: mint,
      marketWideCapture: 'paused',
      note: 'Enrichment budget is directed at this mint until focus is released.',
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to set stream focus', 500),
    );
  }
}
