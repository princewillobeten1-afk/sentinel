import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { tokenSearchEngine } from '@/lib/market-data/rankings/search-engine';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/search — multi-tier search with cursor pagination */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || '';
    const cursor = url.searchParams.get('cursor') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 20;

    const result = tokenSearchEngine.search(q, cursor, limit);

    return jsonResponse({
      query: q,
      items: result.items,
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Search failed', 500));
  }
}
