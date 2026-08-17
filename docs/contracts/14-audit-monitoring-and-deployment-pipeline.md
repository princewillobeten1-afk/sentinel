# 14 — Audit, Monitoring & Deployment Pipeline

Spec §62-70, §73 (audit requirements, bug bounty, contract monitoring, emergency incident flow, security dashboard, deployment pipeline, mainnet deployment, cost optimization, upgrade strategy, "the contract must enforce it").

## Audit & bug bounty (spec §62-63)

Cites and extends `docs/security/out-of-scope.md` rather than duplicating it. That doc's smart-contract-audit row now reads (edited this sprint): a written specification and typed interfaces exist as of Sprint 36, but no deployed on-chain program exists yet — commissioning a real audit is only meaningful against real Anchor/Rust code, not a specification. The same logic applies to a bug-bounty program: nothing is deployed to find bugs in yet. Both remain correctly listed in `docs/contracts/out-of-scope.md`.

A single audit should never be treated as proof of safety (spec §62's own words) — this spec doesn't wait until real implementation to say so.

## Monitoring & incident response (spec §64-66)

Cites `docs/security/incident-response.md` and the existing kill switch (`lib/server/kill-switch.ts`, mirrored on-chain by `IEmergencyController`, `07-access-control-and-emergency-controller.md`) as **today's real mechanism** — no new monitoring code is written this sprint. The incident flow spec §65 describes (detection → risk assessment → emergency action → pause → investigate → communicate → remediate → resume) already has a real first step in this codebase: `IEmergencyController.pause` + `getPauseHistory` are exactly the "pause affected functionality" and "communicate" (via a visible, queryable history) steps, once real.

A future contract-security dashboard (spec §66) would read: `contract_deployments`/`contract_verifications`/`contract_role_grants` (`12-versioning-and-deployment-registry.md`) for status/version/upgrade-authority/admin-roles; `ITreasury.getBalance` for treasury state; `ILiquidityManager.getLockStatus` for liquidity; `IEmergencyController.isPaused`/`getPauseHistory` for pause status. Every field spec §66 asks for already has a typed source in this specification — no new interface is needed to build that dashboard once the underlying contracts are real.

## Deployment pipeline & phased mainnet rollout (spec §67-68)

Described as policy, not built — no CI/CD target exists to deploy a program to (this environment has no Rust/Anchor toolchain at all, `docs/contracts/README.md`). The policy:

```text
Code → Compile → Unit Tests → Fuzz Tests → Invariant Tests →
Static Analysis → Security Review → Audit → Testnet → Canary → Mainnet
```

Phased by contract, not all-at-once (spec §68):

```text
Phase 1: TokenFactory
Phase 2: Launchpad + LaunchController
Phase 3: BondingCurve + LiquidityManager
Phase 4: TradingRouter + DEX adapters
Phase 5: FeeController + Treasury + AccessController + EmergencyController (deployed first in practice, since every other phase depends on access control existing — listed last here only because spec §68 orders it last; the actual dependency order is the opposite)
```

That inversion is worth stating plainly: `AccessController`/`EmergencyController` are dependencies of every other contract (every privileged method above takes an `actor` and is expected to check roles/pause state), so a real rollout would deploy them *before* `TokenFactory`, not after — the spec's own phase numbering shouldn't be read as a literal dependency order.

## Upgrade strategy (spec §36-38, §70)

Every contract in `01-architecture-and-chain-strategy.md`'s inventory must declare one of: immutable, upgradeable, upgradeable-through-governance, or upgradeable-through-multisig — no ambiguity. This spec does not yet assign a specific policy per contract (that's an implementation-time decision informed by which contracts hold funds directly — `Treasury`, most obviously — versus which are pure logic). What's fixed now: `ContractUpgraded` events (`11-event-indexing-and-schema.md`) and `contract_deployments.previous_version_id` (`12-versioning-and-deployment-registry.md`) make any upgrade path — whichever policy is eventually chosen — observable after the fact, which is the one property spec §37 actually requires regardless of policy.

## Cost optimization (spec §69) & the critical principle (spec §73)

> Never sacrifice security merely to save transaction fees.

Not a new statement — the whole shape of this specification already reflects it: every interface above requires the "expensive but correct" parameter (`minAmountOut`, `deadline`, explicit role checks) rather than making it optional for a cheaper call path. Spec §73's broader point — *"the smart contract must enforce it whenever technically possible," never "the frontend prevents it"* — is the same principle `lib/server/csrf.ts`, `lib/order/risk.ts`, and `lib/security/approval-risk.ts` already apply at the application layer in this codebase (server-side enforcement, not UI-only). A real on-chain implementation is this same principle applied one layer deeper, not a new one.
