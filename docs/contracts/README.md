# Project Sentinel Smart Contracts

Sprint 36's smart-contract foundation: a written specification, typechecked
TypeScript interfaces, and a schema-as-documentation deployment registry for
everything the platform's on-chain layer will eventually need to be — not
deployed code, because this environment has no Rust/Anchor toolchain
(confirmed: zero `.rs`/`Anchor.toml`/`Cargo.toml`/`@coral-xyz/anchor` anywhere
in the repo).

This mirrors [`docs/security/README.md`](../security/README.md) and
[`docs/performance/README.md`](../performance/README.md)'s framing: **deep
core, honest about the rest** — but for this sprint specifically, "deep
core" means a real specification and real interfaces, not real chain
behavior, because chain behavior isn't buildable here at all. Every item in
the source spec's own acceptance checklist is phrased "X is documented" /
"X specification exists," never "X is implemented" — this sprint answers
that literally.

## What's real

| Area | Status | Where |
|---|---|---|
| Contract architecture & inventory | Documentation | [`01-architecture-and-chain-strategy.md`](./01-architecture-and-chain-strategy.md) |
| `ITokenFactory` | Real interface, no on-chain implementation | `lib/contracts/token-factory.ts` |
| `ILaunchpad` / `ILaunchController` | Real interface + real, tested state-machine logic | `lib/contracts/launchpad.ts` — `LAUNCH_STATE_TRANSITIONS`/`isValidLaunchStateTransition`, `lib/contracts/__tests__/launchpad-state-machine.test.ts` |
| `IBondingCurve` | Real interface, backed by the real, pre-existing `BondingCurveEngine` | `lib/contracts/bonding-curve.ts`, `lib/launchpad/bonding-curve.ts` |
| `ILiquidityManager` | Real interface, no on-chain implementation | `lib/contracts/liquidity-manager.ts` |
| `IFeeController` | Real interface + real, tested fee-split logic | `lib/contracts/fee-controller.ts` — `calculateFeeSplit`, `lib/contracts/__tests__/fee-split.test.ts` |
| `ITreasury` | Real interface, no on-chain implementation | `lib/contracts/treasury.ts` |
| `IAccessController` | Real interface, no on-chain implementation | `lib/contracts/access-controller.ts` |
| `IEmergencyController` | Real interface, mirrors the real off-chain kill switch | `lib/contracts/emergency-controller.ts`, `lib/server/kill-switch.ts` |
| `ITradingRouter` / `IDexAdapter` | Real interface, no on-chain implementation | `lib/contracts/trading-router.ts` |
| Contract event schema | Real interface + real, tested mapping logic | `lib/contracts/events.ts` — `ContractEvent`, `toBlockchainEventRow`, `lib/contracts/__tests__/events.test.ts` |
| Deployment registry | Real interface + schema-as-documentation migration | `lib/contracts/deployment-registry.ts`, `db/migrations/014_smart_contract_platform.sql` |
| Reconciled creator allocation cap (15%) | **Real** — actually enforced in existing pre-flight scoring | `lib/launchpad/risk.ts` |
| Reconciled launch state machine | **Real** — the old, informal, second state vocabulary and its dead route tree were deleted | (was `app/api/launches/**`, now removed) |

## What's fixed (pre-existing gaps found while writing this spec)

Not pre-planned sprint items — found while reconciling the launchpad
simulation this specification needed to describe accurately, and fixed at
the root rather than left inconsistent, matching this project's established
practice (see `docs/security/README.md`'s and `docs/performance/README.md`'s
equivalent sections from prior sprints):

- **Two coexisting launch state machines.** `LaunchState` (real, used by the live `app/api/v1/launches/**`) and an informal `DRAFT/READY/LAUNCHING` vocabulary in a separate, unauthenticated, `console.log`-stubbed route tree (`app/api/launches/**`). Confirmed the second tree was called only by two components never mounted into any page — deleted outright, along with a second, unwired launch validator (`lib/launchpad/validator.ts`).
- **Three conflicting creator-allocation-cap thresholds** (10% in `risk.ts`, 20% in the now-deleted validator, 15% published in `docs/architecture/11-launchpad-and-reputation.md`). Reconciled to 15% — the only number already published as a stated product invariant — with `risk.ts` updated to a three-tier scale and new boundary tests added.
- **`lib/execution/router.ts` and its test had real, pre-existing TypeScript errors** (a required `mevRisk: MEVRisk` field missing from two mock DEX adapters' quote objects; a test using an invalid `priority: 'MEDIUM'` value and incomplete `ExecutionRequest` literals) — hidden by the same stale-incremental-build-info-cache pattern found and documented in Sprint 31, surfaced again once this sprint's file deletions forced a fuller recheck. Fixed at the root: added `mevRisk`, corrected the test fixtures.
- **`docs/security/out-of-scope.md`'s smart-contract-audit line** was accurate but became slightly stale once this specification existed — updated to distinguish "nothing to audit" (was true) from "nothing deployed to audit against" (true now).

## What's documentation, not implementation

| Doc | Covers |
|---|---|
| [`02-token-factory.md`](./02-token-factory.md) | `ITokenFactory`, creation flow, immutable-vs-configurable fields, no hidden minting |
| [`03-launchpad-and-launch-controller.md`](./03-launchpad-and-launch-controller.md) | Canonical launch state machine, retired-vocabulary mapping, `ILaunchpad`/`ILaunchController` |
| [`04-bonding-curve.md`](./04-bonding-curve.md) | `IBondingCurve`, a real worked buy/sell/graduation example, invariants |
| [`05-liquidity-manager.md`](./05-liquidity-manager.md) | `ILiquidityManager`, liquidity migration/locking/ownership |
| [`06-fee-controller-and-treasury.md`](./06-fee-controller-and-treasury.md) | `IFeeController`/`ITreasury`, a real worked fee-split table, treasury separation |
| [`07-access-control-and-emergency-controller.md`](./07-access-control-and-emergency-controller.md) | `IAccessController`/`IEmergencyController`, least privilege, pause granularity |
| [`08-trading-router-and-dex-adapters.md`](./08-trading-router-and-dex-adapters.md) | `ITradingRouter`/`IDexAdapter`, not forcing proprietary liquidity, slippage/deadline protection |
| [`09-creator-accountability-and-reputation.md`](./09-creator-accountability-and-reputation.md) | Which system on-chain events feed (`lib/creator`/`lib/ownership`, not `lib/trust`), the reconciled 15% cap |
| [`10-third-party-token-risk-flagging.md`](./10-third-party-token-risk-flagging.md) | One contract-risk vocabulary for first- and third-party tokens alike |
| [`11-event-indexing-and-schema.md`](./11-event-indexing-and-schema.md) | The full event union, mapping onto `blockchain_events` |
| [`12-versioning-and-deployment-registry.md`](./12-versioning-and-deployment-registry.md) | Deployment/verification/role-grant schema, semver policy |
| [`13-verification-testing-and-simulation.md`](./13-verification-testing-and-simulation.md) | What's real vs. future-requirement across testing/fuzzing/simulation/formal verification |
| [`14-audit-monitoring-and-deployment-pipeline.md`](./14-audit-monitoring-and-deployment-pipeline.md) | Audit/bug-bounty (cites `docs/security/`), monitoring, phased deployment, upgrade policy |
| [`out-of-scope.md`](./out-of-scope.md) | Real Rust/Anchor code, fuzz/invariant/fork testing, formal verification, live audits, multi-chain — and why each needs tooling or engagement this sprint doesn't have |

## Verification

No live blockchain verification applies — nothing described here is
deployed. What was actually run: `npm run build` (full TypeScript
type-check across every new `lib/contracts/**` file, the reconciled
`lib/launchpad/**`/`lib/execution/**` files, and confirmation the deleted
routes leave no dangling imports anywhere reachable from `app/`) and
`npm test` (29 new tests across 3 new files, plus the full existing suite
including the reconciled `lib/launchpad/__tests__/risk.test.ts` boundary
cases). The bonding-curve and fee-split worked examples in
`04-bonding-curve.md` and `06-fee-controller-and-treasury.md` are real
output from the real, pre-existing engines, captured while writing this
doc — not hand-computed. Explicitly not claimed anywhere in this doc set:
real deployment, real fuzz/invariant/fork test runs, external audit,
formal verification — all listed honestly in
[`out-of-scope.md`](./out-of-scope.md) instead.
