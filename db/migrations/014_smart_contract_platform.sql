-- ============================================================================
-- Sprint 36 — Smart Contract Platform Schema
--
-- NOTE ON STATUS: same relationship as every prior migration in this
-- directory — real schema, NOT yet wired to application code.
-- `lib/server/database.ts` is still a mock client, and no on-chain program
-- has been written or deployed anywhere in this repo (see
-- `docs/contracts/README.md` and `docs/security/out-of-scope.md`). This is
-- the durable target a future deployment pipeline would write to once a
-- real Anchor/Rust program exists — documentation-with-DDL, not an active
-- persistence path.
--
-- Mirrors `lib/contracts/deployment-registry.ts`'s
-- `ContractDeploymentRecord`/`ContractVerificationRecord`/`ContractRoleGrantRecord`
-- types exactly — those TS types were written first; these column names
-- follow them, not the other way around.
-- ============================================================================

-- ── 1. Contract Deployments (spec §54-55) ──
-- One row per on-chain program deployment. `contract_name` is one of the 10
-- contracts specified in docs/contracts/01-architecture-and-chain-strategy.md
-- (TokenFactory, Launchpad, LaunchController, BondingCurve, LiquidityManager,
-- FeeController, Treasury, AccessController, EmergencyController,
-- TradingRouter). `previous_version_id` makes upgrade history observable
-- (spec §37 — implementation address, upgrade authority, version, and
-- previous implementation must all be inspectable).

CREATE TABLE IF NOT EXISTS contract_deployments (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL DEFAULT 'solana',
  contract_name VARCHAR(64) NOT NULL,
  version VARCHAR(32) NOT NULL, -- semver, e.g. '0.1.0'
  program_address VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'unreleased', -- 'unreleased' | 'active' | 'deprecated' | 'retired'
  deployed_by VARCHAR(128),
  deployed_at TIMESTAMPTZ,
  deployment_tx VARCHAR(128),
  previous_version_id VARCHAR(64) REFERENCES contract_deployments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contract_version UNIQUE (chain_id, contract_name, version)
);

CREATE INDEX IF NOT EXISTS idx_contract_deployments_lookup
  ON contract_deployments (chain_id, contract_name, status);

-- ── 2. Contract Verifications (spec §56) ──
-- Source-code verification status per deployment (e.g. against a chain
-- explorer's verification service). Separate from `contract_deployments`
-- because a deployment can exist before it's verified, and verification
-- status can change independently of the deployment record itself.

CREATE TABLE IF NOT EXISTS contract_verifications (
  id VARCHAR(64) PRIMARY KEY,
  deployment_id VARCHAR(64) NOT NULL REFERENCES contract_deployments(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_source VARCHAR(64), -- e.g. 'solscan', 'internal-review'
  source_hash VARCHAR(128),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_verifications_deployment
  ON contract_verifications (deployment_id);

-- ── 3. Contract Role Grants (spec §31-32) ──
-- Mirrors `IAccessController`'s role grants (`lib/contracts/access-controller.ts`)
-- per deployment — distinct from this application's own `lib/server/rbac.ts`
-- `user`/`admin`/`analyst` roles, which govern the REST API, not a
-- privileged on-chain instruction.

CREATE TABLE IF NOT EXISTS contract_role_grants (
  id VARCHAR(64) PRIMARY KEY,
  deployment_id VARCHAR(64) NOT NULL REFERENCES contract_deployments(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL, -- 'PROTOCOL_ADMIN' | 'FEE_MANAGER' | 'EMERGENCY_ADMIN' | 'TREASURY_SIGNER' | 'UPGRADE_AUTHORITY'
  grantee_address VARCHAR(128) NOT NULL,
  granted_by VARCHAR(128) NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_role_grants_deployment
  ON contract_role_grants (deployment_id, role);
