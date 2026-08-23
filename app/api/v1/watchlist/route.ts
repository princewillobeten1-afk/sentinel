export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { pgWatchlistRepository, type WatchlistRow } from '@/lib/server/db/watchlist-repository';

/**
 * The caller's watchlist.
 *
 * Both handlers previously read `userId` from the request — a query parameter on
 * GET, a body field on POST — defaulting to `'user_default'`, with no
 * authentication anywhere. Any caller could read or modify any user's watchlist
 * by passing an id, and an unauthenticated caller silently shared one global
 * list. The user id now comes from the session and nowhere else.
 *
 * Storage moved from a per-process `Map` (which also seeded tokens the user
 * never chose) to `watchlist_items`, so a watchlist survives a restart and
 * follows the user across devices.
 */

function toDto(row: WatchlistRow) {
  return {
    mint: row.mint,
    chain: row.chain,
    note: row.note,
    addedAt: new Date(row.added_at).toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const rows = await pgWatchlistRepository.list(user.userId);

    return jsonResponse({
      items: rows.map(toDto),
      count: rows.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch watchlist', 500));
  }
}

/** POST — add, remove, or toggle a token on the caller's own watchlist. */
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => null);

    // `tokenId` kept as an accepted alias so existing callers keep working.
    const mint: string | undefined = body?.mint ?? body?.tokenId;
    const chain: string = body?.chain ?? 'solana';
    const action: string = body?.action ?? 'toggle';

    if (!mint || typeof mint !== 'string') {
      throw new ApiError('mint is required', 400, 'INVALID_REQUEST');
    }
    if (!['add', 'remove', 'toggle'].includes(action)) {
      throw new ApiError('action must be add, remove or toggle', 400, 'INVALID_REQUEST');
    }

    let isWatchlisted: boolean;
    if (action === 'add') {
      await pgWatchlistRepository.add(user.userId, mint, chain);
      isWatchlisted = true;
    } else if (action === 'remove') {
      await pgWatchlistRepository.remove(user.userId, mint);
      isWatchlisted = false;
    } else {
      isWatchlisted = await pgWatchlistRepository.toggle(user.userId, mint, chain);
    }

    return jsonResponse({
      mint,
      isWatchlisted,
      action: isWatchlisted ? 'added' : 'removed',
      count: await pgWatchlistRepository.count(user.userId),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update watchlist', 500));
  }
}
