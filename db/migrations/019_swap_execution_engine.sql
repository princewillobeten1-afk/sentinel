-- Sprint 47: Swap Execution Engine Migration

CREATE TABLE IF NOT EXISTS executions (
  execution_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  token_in TEXT NOT NULL,
  token_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  actual_output TEXT,
  slippage REAL NOT NULL,
  route TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_executions_user ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_wallet ON executions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_created ON executions(created_at);

CREATE TABLE IF NOT EXISTS transaction_intents (
  intent_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREPARED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_intents_idempotency ON transaction_intents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_intents_exec ON transaction_intents(execution_id);

CREATE TABLE IF NOT EXISTS execution_attempts (
  attempt_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  transaction_hash TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_exec ON execution_attempts(execution_id);
CREATE INDEX IF NOT EXISTS idx_attempts_tx ON execution_attempts(transaction_hash);

CREATE TABLE IF NOT EXISTS transaction_receipts (
  receipt_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  transaction_hash TEXT NOT NULL UNIQUE,
  block_number INTEGER NOT NULL,
  block_hash TEXT,
  gas_used TEXT NOT NULL,
  effective_gas_price TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_tx ON transaction_receipts(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_receipts_exec ON transaction_receipts(execution_id);

CREATE TABLE IF NOT EXISTS execution_events (
  event_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES executions(execution_id)
);

CREATE INDEX IF NOT EXISTS idx_events_exec ON execution_events(execution_id);

CREATE TABLE IF NOT EXISTS token_approvals (
  approval_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  spender_address TEXT NOT NULL,
  amount_approved TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approvals_wallet ON token_approvals(wallet_address, token_address);

CREATE TABLE IF NOT EXISTS execution_blocklist (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL, -- 'TOKEN' | 'CONTRACT'
  target_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_blocklist_val ON execution_blocklist(target_value);
