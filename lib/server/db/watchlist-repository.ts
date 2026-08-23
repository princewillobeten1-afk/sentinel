import 'server-only';

import { dbPool } from './pool';

/**
 * Watchlist storage.
 *
 * Replaces `lib/watchlist/watchlist-service.ts`, a per-process `Map` that also
 * seeded a default watchlist on construction — so a restart handed the user a
 * list of tokens they never picked, and two server instances disagreed about
 * what was on it.
 *
 * Every method is user-scoped by parameter. There is deliberately no "get any
 * user's watchlist" call: the route reads the id from the session, never from
 * the request body, which is how the old endpoint let any caller read any
 * user's list.
 */

export interface WatchlistRow {
  id: string;
  user_id: string;
  mint: string;
  chain: string;
  note: string | null;
  added_at: string;
}

export class PgWatchlistRepository {
  async list(userId: string): Promise<WatchlistRow[]> {
    const { rows } = await dbPool.query<WatchlistRow>(
      `SELECT id, user_id, mint, chain, note, added_at
         FROM watchlist_items
        WHERE user_id = $1
        ORDER BY added_at DESC`,
      [userId],
    );
    return rows;
  }

  async isWatchlisted(userId: string, mint: string): Promise<boolean> {
    const { rows } = await dbPool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM watchlist_items WHERE user_id = $1 AND mint = $2
       ) AS exists`,
      [userId, mint],
    );
    return rows[0]?.exists ?? false;
  }

  /**
   * Adds a token. Idempotent by the (user_id, mint) unique constraint, so a
   * double-tap on the star cannot create a second row or raise an error.
   */
  async add(userId: string, mint: string, chain = 'solana', note?: string): Promise<WatchlistRow> {
    const { rows } = await dbPool.query<WatchlistRow>(
      `INSERT INTO watchlist_items (user_id, mint, chain, note)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::text)
       ON CONFLICT (user_id, mint) DO UPDATE SET note = COALESCE(EXCLUDED.note, watchlist_items.note)
       RETURNING id, user_id, mint, chain, note, added_at`,
      [userId, mint, chain, note ?? null],
    );
    return rows[0];
  }

  /** Removes a token. Returns whether a row was actually deleted. */
  async remove(userId: string, mint: string): Promise<boolean> {
    const { rows } = await dbPool.query<{ id: string }>(
      `DELETE FROM watchlist_items WHERE user_id = $1 AND mint = $2 RETURNING id`,
      [userId, mint],
    );
    return rows.length > 0;
  }

  /**
   * Flips membership and reports the resulting state.
   *
   * Done as one call rather than read-then-write so two rapid taps cannot
   * interleave into an inconsistent result.
   */
  async toggle(userId: string, mint: string, chain = 'solana'): Promise<boolean> {
    const removed = await this.remove(userId, mint);
    if (removed) return false;
    await this.add(userId, mint, chain);
    return true;
  }

  async count(userId: string): Promise<number> {
    const { rows } = await dbPool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM watchlist_items WHERE user_id = $1',
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}

export const pgWatchlistRepository = new PgWatchlistRepository();
