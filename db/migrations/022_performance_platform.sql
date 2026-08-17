-- ============================================================================
-- Sprint 31 — Performance Platform Schema
--
-- NOTE ON STATUS: same relationship as every prior migration in this
-- directory — real schema, NOT yet wired to application code.
-- `lib/server/database.ts` is still a mock client, so the runtime for
-- everything below is `lib/market/mock-ohlcv.ts`'s deterministic, stateless
-- candle generator (see docs/performance/README.md). This table is the
-- durable target that generator's output maps onto once a real driver and a
-- real market-data ingestion pipeline exist — documentation-with-DDL, not an
-- active persistence path.
-- ============================================================================

-- ── Token Candles (Item 12) ──
-- One row per (token, chain, timeframe, open_time). The application today
-- never writes here — `generateCandleRange()` recomputes any requested range
-- on demand instead of reading/writing rows, which is why it can serve an
-- arbitrary `before` page with no cache and get byte-identical results.
-- This table is what a real OHLCV pipeline (chain indexer or upstream feed)
-- would actually persist to, at which point the API route swaps its call
-- from the generator to a query against this table with no response-shape
-- change.

CREATE TABLE token_candles (
  id BIGSERIAL PRIMARY KEY,
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d')),
  open_time TIMESTAMPTZ NOT NULL,
  open_price NUMERIC(38, 18) NOT NULL,
  high_price NUMERIC(38, 18) NOT NULL,
  low_price NUMERIC(38, 18) NOT NULL,
  close_price NUMERIC(38, 18) NOT NULL,
  volume NUMERIC(38, 18) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain, token_address, timeframe, open_time)
);

-- The API route's two access patterns: "latest N candles" and "N candles
-- before a given time" — both are a range scan on this composite key,
-- ordered by open_time descending.
CREATE INDEX idx_token_candles_lookup
  ON token_candles (chain, token_address, timeframe, open_time DESC);
