CREATE TABLE IF NOT EXISTS ai_copilot_sessions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
);
CREATE INDEX IF NOT EXISTS ai_copilot_sessions_owner ON ai_copilot_sessions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ai_copilot_turns (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES ai_copilot_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  context JSONB NOT NULL,
  facts JSONB NOT NULL,
  answer JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_copilot_turns_session ON ai_copilot_turns(session_id, created_at);
CREATE TABLE IF NOT EXISTS ai_copilot_observations (
  id BIGSERIAL PRIMARY KEY,
  mint VARCHAR(44) NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  facts JSONB NOT NULL,
  provenance JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_copilot_observations_mint ON ai_copilot_observations(mint, observed_at DESC);
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS input_tokens INT;
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS output_tokens INT;
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS thinking_tokens INT;
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(64);
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS tool_outcomes JSONB;
ALTER TABLE ai_usage_metrics ADD COLUMN IF NOT EXISTS request_status VARCHAR(32);
ALTER TABLE ai_usage_metrics ALTER COLUMN grounding_score DROP NOT NULL;
