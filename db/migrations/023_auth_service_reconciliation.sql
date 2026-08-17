-- ============================================================================
-- Migration 023 — Auth Service Reconciliation (Phase 2 — Auth Hardening)
--
-- Moves `lib/auth/*`'s services (register/login/password-reset/email-
-- verification/wallet-linking, built by earlier work against the in-memory
-- `lib/db/repository.ts`) onto the real Postgres tables from 013/020.
--
-- Their TypeScript contracts (`lib/db/schema.ts`) expect a few columns the
-- existing tables don't have yet. Rather than reshape those contracts — which
-- ~23 call sites across lib/auth depend on — the columns are added here.
-- ============================================================================

-- `DbWalletVerification` (lib/db/schema.ts) records WHICH challenge proved a
-- wallet and HOW. 013's wallet_verifications only stores the challenge string
-- and signature inline, with no link to auth_challenges and no method field.
ALTER TABLE wallet_verifications
    ADD COLUMN IF NOT EXISTS challenge_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS method VARCHAR(16) NOT NULL DEFAULT 'SIWS',
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 013 declares `challenge`/`expires_at` NOT NULL, but the verification record
-- is written *after* a challenge is consumed — the raw challenge string and
-- its expiry are no longer meaningful at that point (the challenge row is
-- deleted by `consumeChallenge`). Relaxed so a verification can be recorded
-- by challenge_id alone.
ALTER TABLE wallet_verifications
    ALTER COLUMN challenge DROP NOT NULL,
    ALTER COLUMN expires_at DROP NOT NULL;

-- `DbUserSession.token_hash` — sessions are looked up by id (the JWT's `sid`),
-- but the contract carries a token hash for the eventual
-- hash-the-token-at-rest path. Nullable: nothing populates it yet.
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_wallet_verifications_wallet ON wallet_verifications(wallet_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_hash ON email_verification_tokens(token_hash);
