# 12 — Contract Versioning & Deployment Registry

Spec §54-56 (contract versioning, deployment registry, contract verification).

## Schema

`db/migrations/014_smart_contract_platform.sql` — schema-as-documentation, same relationship to application code as every prior migration in this directory (`lib/server/database.ts` is still a mock client; nothing queries these tables). Written to match `lib/contracts/deployment-registry.ts`'s TS types exactly — the TS types were written first, the SQL columns follow them.

### `contract_deployments`

One row per on-chain program deployment. `contract_name` is one of the 10 contracts in `01-architecture-and-chain-strategy.md`'s inventory. `previous_version_id` self-references the row it supersedes, making upgrade history observable (spec §37 — implementation address, upgrade authority, version, and previous implementation must all be inspectable) without a separate history table.

| Column | Notes |
|---|---|
| `chain_id` | `'solana'` today (`01-architecture-and-chain-strategy.md`) |
| `contract_name` | e.g. `'Launchpad'`, `'BondingCurve'` |
| `version` | Semver — see below |
| `status` | `'unreleased' \| 'active' \| 'deprecated' \| 'retired'` |
| `previous_version_id` | Self-FK, nullable — absent for a contract's first-ever deployment |

### `contract_verifications`

Separate from `contract_deployments` because a deployment can exist before it's verified, and verification status can change independently (spec §56 — production contracts should be publicly verifiable where supported, and the deployment process should automatically verify source code against the appropriate explorer). `verified: false` is the honest default — a row existing does not itself imply verification succeeded.

### `contract_role_grants`

Mirrors `IAccessController`'s role grants (`07-access-control-and-emergency-controller.md`) per deployment. `revoked_at` nullable — a grant with `revoked_at IS NULL` is currently active.

## Semver policy

`version` follows standard semver (`MAJOR.MINOR.PATCH`):
- **MAJOR** — a breaking change to a contract's public interface (spec §71's `ITokenFactory`/`ILaunchpad`/etc. equivalents) or a change to an invariant a trader could have relied on (e.g. the 15% allocation cap, `09-creator-accountability-and-reputation.md`).
- **MINOR** — a new capability that doesn't change existing behavior (e.g. a new `IDexAdapter` registration).
- **PATCH** — a fix with no interface or invariant change.

`status: 'unreleased'` is the only status a deployment can start in — nothing in this registry design allows skipping straight to `'active'`, matching the phased-rollout policy in `14-audit-monitoring-and-deployment-pipeline.md`.
