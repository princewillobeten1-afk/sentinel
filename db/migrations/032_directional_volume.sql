-- Directional 24h volume for discovered tokens (Phase 5).
--
-- Migration 031 stored total and organic 24h volume. The discovery source
-- reports those as four separate figures — buy, sell, organic buy, organic sell
-- — and collapsing them to two sums discarded the direction.
--
-- Direction is not a nicety here. `/api/v1/analytics/market` previously
-- reported a buy/sell split of 52/48 for every request, because with no trade
-- data the decomposition engine multiplies the total by fixed ratios
-- (`lib/analytics/volume-decomposition.ts`). Storing the real figures is what
-- lets that endpoint report a measured split instead of a constant one.

ALTER TABLE realtime_tokens
    ADD COLUMN IF NOT EXISTS buy_volume_24h_usd          NUMERIC(24,6),
    ADD COLUMN IF NOT EXISTS sell_volume_24h_usd         NUMERIC(24,6),
    ADD COLUMN IF NOT EXISTS organic_buy_volume_24h_usd  NUMERIC(24,6),
    ADD COLUMN IF NOT EXISTS organic_sell_volume_24h_usd NUMERIC(24,6),
    -- Trader counts behind the volume. A large figure from a handful of wallets
    -- and the same figure from thousands are different markets, and the
    -- difference is what distinguishes wash trading from demand.
    ADD COLUMN IF NOT EXISTS trader_count_24h            INTEGER,
    ADD COLUMN IF NOT EXISTS buy_count_24h               INTEGER,
    ADD COLUMN IF NOT EXISTS sell_count_24h              INTEGER;
