-- A signature can contain multiple trade instructions. Preserve the existing
-- transaction-level aggregates while allowing exact instruction identities
-- when an upstream decoder actually supplies their positions.
ALTER TABLE realtime_trades ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE realtime_trades ADD COLUMN IF NOT EXISTS instruction_index INTEGER;
ALTER TABLE realtime_trades ADD COLUMN IF NOT EXISTS inner_instruction_index INTEGER;

UPDATE realtime_trades
SET event_id = 'solana:' || signature || ':' || mint || ':' || side || ':aggregate'
WHERE event_id IS NULL;

ALTER TABLE realtime_trades ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE realtime_trades DROP CONSTRAINT IF EXISTS uq_realtime_trades;
ALTER TABLE realtime_trades DROP CONSTRAINT IF EXISTS chk_realtime_trades_commitment;
ALTER TABLE realtime_trades ADD CONSTRAINT chk_realtime_trades_commitment
  CHECK (commitment IN ('unknown', 'processed', 'confirmed', 'finalized'));
ALTER TABLE realtime_trades ALTER COLUMN commitment SET DEFAULT 'unknown';
CREATE UNIQUE INDEX IF NOT EXISTS uq_realtime_trades_event_id ON realtime_trades (event_id);
