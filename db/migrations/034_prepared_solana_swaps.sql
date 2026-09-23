-- Durable wallet-approved swap intents. No private keys or signed payloads.
CREATE TABLE IF NOT EXISTS prepared_solana_swaps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  wallet TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network = 'solana:mainnet'),
  unsigned_tx TEXT NOT NULL,
  last_valid_block_height BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  quote JSONB NOT NULL,
  fee_lamports BIGINT,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'pending', 'confirmed', 'failed', 'expired')),
  signature TEXT UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_key)
);
CREATE INDEX IF NOT EXISTS prepared_solana_swaps_user_created_idx ON prepared_solana_swaps(user_id, created_at DESC);
