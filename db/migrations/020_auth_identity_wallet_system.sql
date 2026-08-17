-- Migration 020: Authentication, Identity & Wallet Connection System (Sprint 43)
-- Defines production schemas for users, sessions, wallets, verifications, challenges, and security events.
--
-- NOTE ON RECONCILIATION WITH 013: this file originally re-declared `users`,
-- `wallets`, `user_sessions`, and `wallet_verifications` as brand-new tables,
-- but 013_production_data_model.sql already creates `users`, `wallets`, and
-- `sessions` (and its own `wallet_verifications`), and runs first (013 <
-- 020). Since nothing has ever executed either file against a real database
-- (both are schema-as-documentation to date), this was corrected in place
-- rather than left as a silent `CREATE TABLE IF NOT EXISTS` no-op that would
-- have quietly dropped every column this file actually needed:
--   - `users`/`wallets` are now ALTERed to add this domain's columns onto
--     013's tables instead of redeclaring them.
--   - `user_sessions` is dropped in favor of ALTERing 013's `sessions` table
--     (one session table, not two).
--   - `wallet_verifications` is dropped — 013 already owns that table name
--     and concept; this domain doesn't populate it yet.
--   - `auth_challenges`, `password_reset_tokens`, `email_verification_tokens`,
--     and `security_audit_events` are genuinely new and kept as-is.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NOT NULL DEFAULT 'Trader',
    ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512),
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_role,
    ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin', 'analyst'));

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_status,
    ADD CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'suspended', 'closed'));

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS ip VARCHAR(64),
    ADD COLUMN IF NOT EXISTS revoked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(255),
    ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS balance_sol NUMERIC(20, 9) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE wallets
    DROP CONSTRAINT IF EXISTS chk_wallets_status,
    ADD CONSTRAINT chk_wallets_status CHECK (status IN ('active', 'inactive', 'suspended'));

-- `DbUserPreferences` (lib/server/store.ts) doesn't map cleanly onto 013's
-- individual `user_settings` columns (different units, no risk-level/
-- density/auto-lock columns) — stored as one JSONB blob instead of forcing
-- a lossy per-column mapping onto a differently-shaped generic settings table.
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS sentinel_preferences JSONB;

CREATE TABLE IF NOT EXISTS auth_challenges (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    wallet_address VARCHAR(128) NOT NULL,
    chain_id VARCHAR(32) NOT NULL,
    nonce VARCHAR(64) NOT NULL UNIQUE,
    message TEXT NOT NULL,
    message_hash VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    new_email VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_audit_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64),
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_nonce ON auth_challenges(nonce);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_events(created_at);
