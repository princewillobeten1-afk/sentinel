import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getMarketSnapshots } from '@/lib/market/db-snapshots';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/market/snapshots — normalized market snapshots.
 *
 * Served `getMockMarketSnapshots()` until now: two hardcoded tokens, one of
 * them quoting SOL at $142.50 against a live price of $92.89. It now reads the
 * enrichment table. See `lib/market/db-snapshots.ts` for which intervals are
 * measured — the 1m/5m/1h fields are not, and their zeros mean unmeasured.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('limit');
    const limit = raw === null ? 25 : Number(raw);
    if (!Number.isFinite(limit) || limit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }

    const snapshots = await getMarketSnapshots(limit);

    return jsonResponse({
      snapshots,
      count: snapshots.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch market snapshots', 500),
    );
  }
}
