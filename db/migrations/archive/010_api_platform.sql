-- ============================================================================
-- Sprint 28 — API Platform & Developer Infrastructure Schema
--
-- NOTE ON STATUS: like 009_portfolio_intelligence.sql, this migration is real
-- schema that is NOT yet wired to application code. `lib/server/database.ts`
-- is still a mock client (`query` returns `{rows: []}`, with an explicit
-- "TODO: Replace with a real database driver" since Sprint 1), so the runtime
-- for API keys / webhooks / usage lives in the in-memory, globalThis-guarded
-- stores in `lib/server/api-keys.ts`, `lib/webhooks/store.ts`, and
-- `lib/server/usage-log.ts`. This file defines the durable target those
-- stores map onto when a real driver lands — it is documentation-with-DDL,
-- not an active persistence path.
-- ============================================================================

-- ── Enums ──

CREATE TYPE api_key_environment_enum AS ENUM ('PRODUCTION', 'SANDBOX');

CREATE TYPE api_key_status_enum AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TYPE api_rate_tier_enum AS ENUM ('FREE', 'DEVELOPER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- Mirrors lib/server/scopes.ts's Scope union exactly. Keep in sync.
CREATE TYPE api_scope_enum AS ENUM (
  'READ_MARKET_DATA',
  'READ_TOKEN_INTELLIGENCE',
  'READ_WALLET_DATA',
  'READ_REPUTATION',
  'READ_PORTFOLIO',
  'READ_ALERTS',
  'TRADE',
  'CREATE_ORDER',
  'CANCEL_ORDER',
  'CREATE_LAUNCH',
  'MANAGE_LAUNCH',
  'MANAGE_WEBHOOKS'
);

CREATE TYPE webhook_status_enum AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE webhook_delivery_status_enum AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED');

-- ── 1. API keys (spec §7, §9) ──
-- The secret itself is never stored; only a SHA-256 digest. `key_prefix` is
-- the display-safe fragment shown in key lists (e.g. "sk_live_ab12").

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  environment api_key_environment_enum NOT NULL DEFAULT 'SANDBOX',
  tier api_rate_tier_enum NOT NULL DEFAULT 'FREE',
  status api_key_status_enum NOT NULL DEFAULT 'ACTIVE',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX api_keys_user_idx ON api_keys (user_id);
CREATE INDEX api_keys_hash_idx ON api_keys (key_hash);
CREATE INDEX api_keys_active_idx ON api_keys (user_id) WHERE status = 'ACTIVE';

-- ── 2. API key scopes (spec §8, §10) ──
-- Normalized rather than a jsonb array so scope membership is efficiently
-- joinable/queryable, and so the enum itself constrains what can be granted.
-- (The in-memory runtime keeps `scopes: Scope[]` inline, which is the natural
-- shape there; this table is the future-driver target, not a 1:1 mirror.)

CREATE TABLE api_key_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  scope api_scope_enum NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_key_id, scope)
);

CREATE INDEX api_key_scopes_key_idx ON api_key_scopes (api_key_id);

-- ── 3. Webhooks (spec §45-48) ──

CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret_hash text NOT NULL,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  status webhook_status_enum NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhooks_user_idx ON webhooks (user_id);
CREATE INDEX webhooks_active_idx ON webhooks (user_id) WHERE status = 'ACTIVE';

-- ── 4. Webhook deliveries (spec §47-49) ──
-- `event_id` is the replay-protection key a receiver dedupes on; unique per
-- (webhook, event) since one upstream event legitimately fans out to many
-- subscribers.

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status webhook_delivery_status_enum NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  response_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, event_id)
);

CREATE INDEX webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id, created_at DESC);
CREATE INDEX webhook_deliveries_due_idx ON webhook_deliveries (next_attempt_at) WHERE status = 'PENDING';

-- ── 5. Usage logs (spec §62-63, §97) ──
-- Shaped after Sprint 9's portfolio_access_log. Deliberately stores no
-- secrets — only the key id, never the key material.

CREATE TABLE usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  route text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX usage_logs_key_time_idx ON usage_logs (api_key_id, occurred_at DESC);
CREATE INDEX usage_logs_user_time_idx ON usage_logs (user_id, occurred_at DESC);
CREATE INDEX usage_logs_request_idx ON usage_logs (request_id);

-- ── 6. Alert subscriptions (spec §44) ──

CREATE TABLE alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  token_ref text,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  webhook_id uuid REFERENCES webhooks(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alert_subscriptions_user_idx ON alert_subscriptions (user_id);
CREATE INDEX alert_subscriptions_enabled_idx ON alert_subscriptions (user_id) WHERE enabled;

-- ── 7. Idempotency records (spec §67-68) ──
-- Included for completeness of the durable target; the runtime keeps these
-- in-memory with a 24h TTL (lib/server/idempotency.ts).

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idempotency_records_expiry_idx ON idempotency_records (expires_at);
