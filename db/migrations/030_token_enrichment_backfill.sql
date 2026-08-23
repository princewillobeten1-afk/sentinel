-- Token enrichment backfill (Phase 5).
--
-- `realtime_tokens` holds mints discovered by the Helius log subscription. The
-- discovery path writes identity only — mint, symbol, decimals, pool — because
-- that is all a log event carries. Market data comes from a separate enrichment
-- pass against Birdeye, which is why 930 discovered rows currently sit with
-- every market column NULL.
--
-- Three things are missing for that pass to be resumable and honest:
--
--  1. `price_change_24h` — the discovery table stores price but not its change,
--     so token cards had no 24h delta to render even once price was filled.
--  2. Provenance (`enriched_at`, `enrichment_status`, `enrichment_error`) — a
--     backfill that cannot tell "never attempted" from "attempted and the token
--     has no market" will retry dead mints forever, and each retry costs quota.
--  3. `promoted_token_id` — the link to the `tokens` registry row, so promotion
--     is idempotent and re-running never duplicates a registry entry.
--
-- NULL keeps meaning "unknown" throughout. A token that genuinely has no
-- liquidity is `enrichment_status = 'NO_MARKET'` with NULL price — never a zero
-- standing in for a measurement we do not have.

ALTER TABLE realtime_tokens
    -- Percent, not fraction: +8.65% stores as 8.65, matching price_change_24h
    -- everywhere else in the API layer.
    ADD COLUMN IF NOT EXISTS price_change_24h   NUMERIC(18,6),
    ADD COLUMN IF NOT EXISTS enriched_at        TIMESTAMPTZ,
    -- PENDING (never attempted) | OK | NO_MARKET (no price source) | ERROR
    ADD COLUMN IF NOT EXISTS enrichment_status  VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS enrichment_error   TEXT,
    ADD COLUMN IF NOT EXISTS promoted_token_id  VARCHAR(64);

-- The backfill's work queue: "rows still worth spending quota on, oldest
-- attempt first". Partial, because OK rows are the majority once the backfill
-- has run and indexing them buys nothing.
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_enrichment_queue
    ON realtime_tokens (enriched_at NULLS FIRST)
    WHERE enrichment_status IN ('PENDING', 'ERROR');

-- Serves "top tokens by volume" — the Overview's Top Tokens tab — without a
-- sort over the full table.
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_volume
    ON realtime_tokens (volume_24h_usd DESC NULLS LAST)
    WHERE enrichment_status = 'OK';

CREATE INDEX IF NOT EXISTS idx_realtime_tokens_liquidity
    ON realtime_tokens (liquidity_usd DESC NULLS LAST)
    WHERE enrichment_status = 'OK';

-- Registry join key. `tokens.address` is the mint, so the registry read path
-- joins straight onto `realtime_tokens.mint`; this index serves that direction.
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_promoted
    ON realtime_tokens (promoted_token_id)
    WHERE promoted_token_id IS NOT NULL;
