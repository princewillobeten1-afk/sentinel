import 'server-only';

import { getDatabaseClient } from '@/lib/server/database';
import { logger } from '@/lib/server/logger';
import type { NormalizedMarketEvent, RawMarketEvent } from '@/lib/market/event-pipeline';

/**
 * Best-effort insert into `market_events`. Always called fire-and-forget from
 * `stream-manager.ts` — never awaited in the WS message handler, never allowed
 * to throw upstream.
 *
 * NOTE: `getDatabaseClient()` is currently a mock client (see
 * lib/server/database.ts — `query` always resolves `{ rows: [] }` with an
 * explicit `TODO: Replace with a real database driver`). This call exercises
 * the correct, ready-to-activate code path; it does not currently make
 * anything durably land in Postgres. That's a separate task.
 *
 * `token_id` is inserted as NULL — resolving mint → tokens.id is out of scope
 * for this pass (no such lookup exists yet).
 */
export async function persistMarketEvent(raw: RawMarketEvent, normalized: NormalizedMarketEvent): Promise<void> {
  const db = await getDatabaseClient();

  const payload = {
    ...normalized,
    rawEventId: raw.eventId,
    rawProviderId: raw.providerId,
  };

  await db.query(
    `INSERT INTO market_events (token_id, event_type, payload, source_provider, event_timestamp)
     VALUES ($1, $2, $3, $4, $5)`,
    [null, raw.eventType, JSON.stringify(payload), raw.providerId, raw.timestamp],
  );
}

export function persistMarketEventFireAndForget(raw: RawMarketEvent, normalized: NormalizedMarketEvent): void {
  void persistMarketEvent(raw, normalized).catch((err) => {
    logger.warn('[market-live] persistMarketEvent failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
