# 09 — Creator Accountability & Reputation Integration

Spec §51-53 (creator bond/skin-in-the-game, creator accountability, reputation integration).

## Which system this feeds

**On-chain creator/liquidity events (once real) are the intended feed for `lib/creator/**` and `lib/ownership/**` — not `lib/trust/**`.**

This distinction matters and is stated explicitly because both exist in this codebase today, doing similar-sounding things:

- `lib/creator/**`/`lib/ownership/**` (`CreatorEntity`, `CreatorLaunchRecord`, `CreatorLiquidityEvent` with `ADDED|REMOVED|MIGRATED`, `EffectiveOwnershipReport`, `WalletClusterV2`) are the **real, production-wired** engines — `lib/launchpad/risk.ts#LaunchRiskEngine.analyzePreLaunch` calls `computeCreatorEntity`/`computeOwnershipReport` from these directly, and they're what actually drives pre-flight launch risk scoring today.
- `lib/trust/**` (`TrustGraphEngine`, `ReputationEngine`, etc.) is a **separate, still-stubbed layer** — every method returns hardcoded mock data regardless of input (`TrustGraphEngine.getEntityGraph()` always returns the same 4-node sample graph; `ReputationEvidenceEngine.fetchEvidenceLog()` always returns the same 2 mock entries). It is not wired into any real risk decision.

A future on-chain `LiquidityLocked`/`BondingCurveTrade`/`LaunchGraduated` event stream (`11-event-indexing-and-schema.md`) is real evidence about a real creator's real behavior — it belongs feeding the system that already treats evidence as real (`lib/creator`/`lib/ownership`), not the system that currently fabricates it (`lib/trust`). Wiring `lib/trust` up to be real is a separate, unscoped piece of work this sprint does not attempt.

## The reconciled 15% allocation cap

`docs/architecture/11-launchpad-and-reputation.md` already publishes a creator-allocation invariant: **deployer wallets may not hold >15% of total supply at launch.** Before this sprint, the codebase actually enforced three different, conflicting numbers (`lib/launchpad/risk.ts` used >10%, a separate unwired validator used >20%). Sprint 36 reconciled `risk.ts` to the published 15% figure — it is now the single number this platform's pre-flight scoring, this spec, and the architecture doc all agree on:

| Allocation | `lib/launchpad/risk.ts` scoring |
|---|---|
| ≤5% | No score impact |
| >5%, ≤10% | +10, no concern message |
| >10%, ≤15% | +20, "Creator allocation is approaching the 15% cap." |
| >15% | +50, "Creator allocation exceeds the platform's 15% hard cap." |

`lib/contracts/__tests__/launchpad-state-machine.test.ts`'s sibling file, `lib/launchpad/__tests__/risk.test.ts`, asserts this boundary directly, including that exactly 15% does **not** trigger the hard-cap message (`>`, not `>=`).

## Creator accountability chain (spec §52)

```text
Creator Wallet
       ↓
Launch (LaunchRecord.creatorWallet)
       ↓
Token (TokenCreationResult.tokenAddress)
       ↓
Liquidity (LiquidityLockRecord)
       ↓
Historical Outcome (CreatorLaunchRecord — lib/creator/types.ts)
```

`CreatorOutcomeType` (`ACTIVE | INACTIVE | LIQUIDITY_WITHDRAWN | SEVERE_ACTIVITY_DECLINE | UNKNOWN`) is the real, neutral vocabulary this chain resolves into — deliberately non-accusatory language (`LIQUIDITY_WITHDRAWN`, not `RUGGED`) even where the underlying event is exactly what a "rug" looks like, because the TS layer's job is describing observed behavior, not adjudicating intent.

**Known, unfixed gap** (flagged, not silently left inconsistent): `db/migrations/013_production_data_model.sql`'s `creator_launches.outcome` column uses a *less neutral* enum (`'graduated'|'active'|'rugged'|'abandoned'`) than the TS-layer `CreatorOutcomeType` above. Reconciling DB wording with TS wording is an application-schema decision, out of a smart-contract specification sprint's scope — noted here so it isn't mistaken for an oversight.

## Creator bond / skin-in-the-game (spec §51)

Not adopted this sprint. A launch fee, creator bond, liquidity requirement, or reputation stake would each need economic simulation (`13-verification-testing-and-simulation.md`) before being sized responsibly — the honest position is "possible mechanism, not yet chosen," not a number picked without that simulation.
