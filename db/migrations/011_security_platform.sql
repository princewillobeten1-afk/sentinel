-- ============================================================================
-- Sprint 30 — Security Platform Schema
--
-- NOTE ON STATUS: same relationship as 009_portfolio_intelligence.sql and
-- 010_api_platform.sql — this is real schema, NOT yet wired to application
-- code. `lib/server/database.ts` is still a mock client, so the runtime for
-- everything below lives in the in-memory, globalThis-guarded stores in
-- `lib/server/session-store.ts`, `lib/server/mfa-store.ts`,
-- `lib/server/kill-switch.ts`, and `lib/server/dual-control.ts`. This file
-- defines the durable target those stores map onto when a real driver
-- lands — documentation-with-DDL, not an active persistence path.
--
-- IMPORTANT (see docs/security/key-management-policy.md): `mfa_credentials.secret`
-- is stored in plaintext here deliberately, matching the in-memory runtime's
-- honest baseline today — HMAC needs the plaintext secret to verify a code,
-- so this is not a shortcut to fix later so much as a signal that this table,
-- specifically, needs KMS-backed envelope encryption before any real driver
-- is pointed at it. Everything else in this file is a normal audit/session
-- table with no such caveat.
-- ============================================================================

-- ── Enums ──

CREATE TYPE audit_entity_type_enum AS ENUM ('user', 'wallet', 'challenge', 'session', 'mfa', 'kill_switch', 'approval_request', 'portfolio');

CREATE TYPE kill_switch_scope_enum AS ENUM ('TRADING', 'LAUNCHPAD');

CREATE TYPE kill_switch_source_enum AS ENUM ('ADMIN', 'CIRCUIT_BREAKER');

CREATE TYPE approval_action_enum AS ENUM ('PAUSE_TRADING', 'RESUME_TRADING', 'PAUSE_LAUNCHPAD', 'RESUME_LAUNCHPAD');

CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- ── 1. Sessions (Tier 2) ──
-- Every issued JWT embeds this row's id as `sid` (lib/server/auth.ts). A
-- session missing here, or with `revoked = true`, or past `expires_at`, means
-- the JWT is rejected regardless of a valid signature — this table is what
-- makes revocation real instead of "wait for natural expiry."

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  mfa_verified boolean NOT NULL DEFAULT false,
  revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_active_idx ON sessions (user_id) WHERE NOT revoked;

-- ── 2. MFA credentials (Tier 2) ──
-- Backup codes ARE one-way hashed (sha256, same approach as api_keys) since
-- they're only ever compared, never recomputed. The TOTP secret cannot be —
-- see the file header note.

CREATE TABLE mfa_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  secret text,
  backup_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  enrolled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Audit log (Tier 3) ──
-- Deliberately a plain `text` action column, not an enum — the in-memory
-- runtime's AuditLogEntry is intentionally wider than the closed
-- AuditEventInput union so pre-existing ad-hoc audit writers (e.g.
-- lib/portfolio/service.ts#recordPortfolioAccess) aren't forced into an
-- unrelated domain's action vocabulary. Mirrored here for the same reason.

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type audit_entity_type_enum,
  entity_id text,
  changes jsonb,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_user_time_idx ON audit_log (user_id, occurred_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action);

-- ── 4. Kill switch state (Tier 4) ──
-- One row per scope, always exactly TRADING and LAUNCHPAD — updated in
-- place, not appended to (the audit trail of who paused/resumed what lives
-- in audit_log via the KILL_SWITCH_* actions, not in this table's history).

CREATE TABLE kill_switch_state (
  scope kill_switch_scope_enum PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  reason text,
  triggered_by uuid REFERENCES users(id) ON DELETE SET NULL,
  triggered_at timestamptz,
  source kill_switch_source_enum
);

-- ── 5. Dual-control approval requests (Tier 3) ──
-- The `requested_by <> approved_by` constraint is the actual enforcement of
-- "two distinct people" at the schema level, mirroring the in-memory store's
-- runtime check in lib/server/dual-control.ts#approve.

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action approval_action_enum NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status approval_status_enum NOT NULL DEFAULT 'PENDING',
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT approval_requires_distinct_approver CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE INDEX approval_requests_pending_idx ON approval_requests (status) WHERE status = 'PENDING';
