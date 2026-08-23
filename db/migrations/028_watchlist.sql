-- ============================================================================
-- 028 — Watchlist persistence
--
-- The watchlist existed twice, and neither copy survived anything:
--
--   * Client: `lib/store/watchlist-store.tsx` kept it in `localStorage` and made
--     zero API calls, so it died with the browser profile and never reached a
--     second device.
--   * Server: `lib/watchlist/watchlist-service.ts` kept it in a per-process
--     `Map` and *seeded a default watchlist on construction*, so every restart
--     handed the user back a list of tokens they never chose.
--
-- `GET /api/v1/watchlist` also read `userId` from a query parameter defaulting
-- to `'user_default'` and never checked authentication, so any caller could read
-- or modify any user's watchlist by passing an id.
--
-- This gives it one home, owned by a real user.
-- ============================================================================

CREATE TABLE IF NOT EXISTS watchlist_items (
    id          BIGSERIAL PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Mint rather than a tokens.id foreign key: a user can watch a token before
    -- the registry has indexed it, and a watchlist entry should never be
    -- rejected because discovery has not caught up.
    mint        VARCHAR(128) NOT NULL,
    chain       VARCHAR(32)  NOT NULL DEFAULT 'solana',
    note        TEXT,
    added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- One entry per token per user. Makes "add" idempotent, so a double-tap on
    -- the star cannot create a duplicate row.
    CONSTRAINT uq_watchlist_user_mint UNIQUE (user_id, mint)
);

-- The only read this table serves: "my watchlist, newest first".
CREATE INDEX IF NOT EXISTS idx_watchlist_user_added ON watchlist_items (user_id, added_at DESC);
