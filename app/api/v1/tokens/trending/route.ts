import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getTrendingTokens } from '@/lib/market-data/rankings/db-trending';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/trending — trending tokens with transparent momentum scores.
 *
 * Reads the enrichment table rather than `rankingEngine`, whose token list was
 * an in-memory seed of four hardcoded entries. That seed is why this endpoint
 * returned exactly three tokens for every request, `?limit=20` included.
 *
 * The scores are transparent in the literal sense: `trendBreakdown` shows each
 * component, and `organicPct` shows how much of the volume behind a rank is
 * genuine. The component that reports activity used to be the constant 18.5 for
 * every token; it is now measured.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') ?? 10);
    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      throw new ApiError('limit must be a positive number', 400, 'INVALID_REQUEST');
    }
    // Same ceiling as the registry endpoint — never unbounded.
    const limit = Math.min(rawLimit, 100);

    const items = await getTrendingTokens(limit);

    return jsonResponse({
      items,
      count: items.length,
      algorithmVersion: 'v2.0-measured-momentum',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch trending tokens', 500));
  }
}
