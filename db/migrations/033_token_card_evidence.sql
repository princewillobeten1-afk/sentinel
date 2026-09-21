CREATE TABLE IF NOT EXISTS token_card_evidence_snapshots (
  mint TEXT NOT NULL,
  evidence_group TEXT NOT NULL CHECK (evidence_group IN ('ownership', 'security', 'creator', 'lifecycle')),
  evidence JSONB NOT NULL,
  audit_version TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mint, evidence_group, observed_at)
);

CREATE INDEX IF NOT EXISTS token_card_evidence_snapshots_observed_idx
  ON token_card_evidence_snapshots (mint, observed_at DESC);
