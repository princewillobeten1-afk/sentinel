import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { watchlistService } from '@/lib/watchlist/watchlist-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/watchlist — list user's watchlisted tokens */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'user_default';
    const items = watchlistService.getWatchlist(userId);

    return jsonResponse({
      userId,
      items,
      count: items.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch watchlist', 500));
  }
}

/** POST /api/v1/watchlist — add or remove a token from the user's watchlist */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId = 'user_default', tokenId, action = 'toggle' } = body;

    if (!tokenId) {
      throw new ApiError('Missing tokenId', 400);
    }

    const isCurrentlyIn = watchlistService.isWatchlisted(userId, tokenId);

    if (action === 'remove' || (action === 'toggle' && isCurrentlyIn)) {
      watchlistService.removeFromWatchlist(userId, tokenId);
      return jsonResponse({
        success: true,
        action: 'removed',
        tokenId,
        isWatchlisted: false,
      });
    }

    watchlistService.addToWatchlist(userId, tokenId);
    return jsonResponse({
      success: true,
      action: 'added',
      tokenId,
      isWatchlisted: true,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update watchlist', 500));
  }
}
