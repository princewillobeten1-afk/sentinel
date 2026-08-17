-- ============================================================================
-- Migration 021 — Self-Custodial Wallet Transaction History
-- (renumbered from 018_wallet_transactions.sql — see 020's header note on
-- the 012/018 numbering collision this renumber resolves)
--
-- NOTE ON STATUS: as of Phase 1 (Postgres Foundation), this migration IS
-- real and executable via `npm run db:migrate` — `lib/server/db/pool.ts` +
-- `wallet-transaction-repository.ts` wire it up for real, sitting behind
-- `lib/server/store.ts`'s unchanged `DbWalletTransaction` /
-- `recordWalletTransaction` / `getWalletTransactions` method signatures,
-- backing `app/api/v1/user/wallets/transactions/route.ts` with zero call-site
-- changes.
--
-- Deliberately NOT a balance ledger: this platform never holds user funds
-- (self-custodial deposit/withdraw — see
-- docs/security/threat-model.md's "Wallet transfers" section) so there is
-- no platform-side balance to reconcile. This table is a local audit/
-- history record of transfers the user's own wallet already signed and
-- broadcast independently, not a source of truth for any balance.
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  direction VARCHAR(16) NOT NULL DEFAULT 'SEND', -- 'SEND' only today; deposits aren't recorded (nothing app-initiated happened)
  asset VARCHAR(16) NOT NULL, -- 'SOL' | 'USDC'
  amount NUMERIC(20, 9) NOT NULL,
  destination_address VARCHAR(64) NOT NULL,
  signature VARCHAR(128) NOT NULL UNIQUE, -- the real on-chain transaction signature
  network VARCHAR(32) NOT NULL, -- 'solana:devnet' | 'solana:mainnet'
  fee_lamports BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_destination ON wallet_transactions(user_id, destination_address);
