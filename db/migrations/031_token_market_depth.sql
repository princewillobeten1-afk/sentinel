-- Deeper market fields for discovered tokens (Phase 5).
--
-- Migration 030 gave `realtime_tokens` price, liquidity, volume and 24h change
-- — enough to render a token card. These four columns cover what the Overview's
-- own tiles claim to show but currently invent:
--
--  * ORGANIC VOLUME (24H) renders a hardcoded $110,891,000 with "74.8% organic".
--    Organic volume is the platform's central premise — volume with the wash
--    trading filtered out — and it was the one number never measured.
--  * Holder count drives concentration and distribution analysis.
--  * FDV alongside market cap: the gap between them is dilution risk, and
--    showing either alone hides it.
--
-- All nullable. A source that does not report one of these leaves it NULL
-- rather than zero, so "we did not measure this" stays distinguishable from
-- "we measured this and it was nothing".

ALTER TABLE realtime_tokens
    -- Buy + sell volume with inorganic flow excluded, as reported by the
    -- discovery source. Always <= volume_24h_usd; the difference is the
    -- suspected wash component.
    ADD COLUMN IF NOT EXISTS organic_volume_24h_usd NUMERIC(24,6),
    ADD COLUMN IF NOT EXISTS holder_count           INTEGER,
    -- Fully diluted valuation. Larger than market cap whenever supply is still
    -- being emitted; equal when it is not.
    ADD COLUMN IF NOT EXISTS fdv_usd                NUMERIC(24,6),
    -- Which upstream produced the market figures on this row, so a wrong number
    -- can be traced to the source that reported it rather than guessed at.
    ADD COLUMN IF NOT EXISTS market_source          VARCHAR(24);

-- Serves the Overview's organic-volume ranking without a full scan.
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_organic_volume
    ON realtime_tokens (organic_volume_24h_usd DESC NULLS LAST)
    WHERE enrichment_status = 'OK';
