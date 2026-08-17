# 13 — Verification, Testing & Economic Simulation

Spec §46-50, §57-61 (anti-manipulation, MEV, anti-sniping, wallet limits, Sybil resistance, test requirements, invariant testing, fork testing, economic simulation, formal verification).

## What's real today vs. described as a future requirement

| Requirement | Status |
|---|---|
| Unit tests on pure reference logic | **Real** — `lib/contracts/__tests__/launchpad-state-machine.test.ts`, `fee-split.test.ts`, `events.test.ts` (29 tests total), plus the reconciled `lib/launchpad/__tests__/risk.test.ts` |
| Integration tests (`TokenFactory → Launchpad`, `Launchpad → Liquidity`, `Router → DEX`) | Not real — no deployed contracts exist to integrate |
| Fuzz testing (spec §57) | Not run. `fast-check` is named as the recommended future library once real contract logic exists to fuzz — not installed, no harness written |
| Invariant testing (spec §58) | Described conceptually only (below); the bonding-curve invariants listed in `04-bonding-curve.md` are the target set, not yet continuously checked against real code |
| Fork testing (spec §59) | Not attempted — needs a real forked-RPC test harness this environment doesn't have |
| Economic simulation (spec §60) | **One real worked example** (below), explicitly not a Monte-Carlo/agent-based market model |
| Formal verification (spec §61) | Described conceptually only — no proof, no spec-language artifact produced; SMT/Certora-style tooling named as the future candidate class |

This table exists so nothing above it is silently assumed done. See `docs/contracts/out-of-scope.md` for the fuller reasoning on each "not real" row.

## Economic simulation — the honest, buildable version

Spec §60 asks for simulating 100/1,000/10,000 buyers, whales, bots, early sellers, and liquidity shocks, then analyzing price/slippage/revenue/outcomes/attack-profitability. Building a real agent-based or Monte-Carlo simulation of that is a substantial, standalone piece of work this sprint does not attempt.

What exists instead: `04-bonding-curve.md`'s worked example is **real output from the real `BondingCurveEngine`** across a short buy/buy/sell sequence — not hand-computed, not a market model, just proof that the deterministic formula behaves sensibly (price rises on buys, falls on sells, price impact is largest on the first trade against a thin curve). It answers "does the curve math work" honestly; it does not answer "what happens with 10,000 concurrent bot buyers," which is a genuinely different and larger question.

## Anti-manipulation & MEV (spec §46-47)

Named as design requirements this specification's interfaces support without claiming to fully solve:
- **Sandwich/front-running**: `ITradingRouter.executeSwap`'s required `minAmountOut` and `deadline` parameters (`08-trading-router-and-dex-adapters.md`) are the two concrete mitigations this spec actually defines. Priority-fee/transaction-ordering-level MEV mitigation (Solana-specific: Jito bundles, private mempools) is a real, chain-specific engineering decision deferred to actual implementation — this spec doesn't pretend to have already made it.
- **Wash trading / artificial volume**: out of this specification's scope directly — `docs/security/out-of-scope.md` already states fraud/manipulation detection needs real trading volume to detect patterns in, which doesn't exist while execution is simulated. `BondingCurveTrade` events (`11-event-indexing-and-schema.md`) are the raw material a real detector would eventually consume.
- **Sybil resistance (spec §50)**: explicitly **not** the same thing as per-wallet contribution limits. A wallet-limit mechanism (spec §49, not adopted as a concrete number this sprint — would need the economic simulation above to size responsibly) stops one wallet from buying unlimited amounts; it does nothing against an attacker using many wallets. Real Sybil resistance is `lib/ownership`'s wallet-clustering analysis (`WalletClusterV2`, `09-creator-accountability-and-reputation.md`) applied to launch participation the same way it's already applied to holder concentration — a detection problem, not a contract-enforced limit.

## Contract testing requirements (spec §57-58), stated as requirements

Once real contract code exists, it needs: unit tests on every function/permission/state transition; integration tests across the contract boundaries above; fuzz tests on random/extreme/unexpected-sequence inputs; and continuous invariant checks (total-supply accounting, balance accounting, fee accounting, liquidity accounting, unauthorized-access rejection — the same invariant categories `04-bonding-curve.md` already lists for the bonding curve specifically). This section states the requirement; it is not itself the test suite.
