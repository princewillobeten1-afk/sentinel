# Explicitly Out of Scope

Per the source spec's 74 sections, these require a Rust/Anchor toolchain,
real deployed contracts, or external engagement this sprint doesn't
provide — building fake versions of them would be decorative, not real.
Listed here so the gap is visible, not silently absent (same discipline as
[`docs/security/out-of-scope.md`](../security/out-of-scope.md) and
[`docs/performance/out-of-scope.md`](../performance/out-of-scope.md)).

| Item | Why it's out of scope this sprint |
|---|---|
| **Real Rust/Anchor program code** | This environment has zero blockchain/Anchor/Rust tooling — confirmed via a repo-wide search for `.rs` files, `Anchor.toml`, `Cargo.toml`, and `@coral-xyz/anchor`/`@solana/web3.js` in `package.json` (none found). Any `.rs` code written here could never be compiled, tested, or verified — for a domain where a subtly broken contract can mean real fund loss, unverifiable "smart contract code" that looks authoritative is worse than no code at all. |
| **Fuzz testing** (spec §57) | No contract bytecode exists to fuzz. `fast-check` is named as the recommended future property-based-testing library once real logic exists — not installed, no harness written. |
| **Invariant testing** (spec §58) | Same reason — the invariant categories are listed (`04-bonding-curve.md`, `13-verification-testing-and-simulation.md`) but nothing continuously checks them against real code, because no real code exists yet. |
| **Fork testing** (spec §59) | Needs a real forked-RPC test harness against realistic chain state — this environment has no RPC access configured for that purpose and no forking tooling installed. |
| **Formal verification** (spec §61) | No bytecode or proof-friendly intermediate representation exists to verify. SMT-based/Certora-style tooling is named as the class of future tooling that would apply — none is installed or run. |
| **Live audit engagement** | Requires an independent third-party smart-contract security firm — not something a codebase can commission on itself. `docs/security/out-of-scope.md`'s equivalent row was updated this sprint: a specification now exists to audit against, but nothing is deployed yet, so an audit still isn't meaningful today. |
| **Bug bounty program** | Same reasoning as an audit — nothing is deployed for a researcher to find a real bug in. |
| **Real economic simulation at scale** (100/1,000/10,000 simulated buyers, spec §60) | `13-verification-testing-and-simulation.md` includes one real worked example using the actual `BondingCurveEngine` across a short buy/sell sequence — explicitly not a Monte-Carlo or agent-based market model. Building that model is a substantial, standalone piece of work, not a byproduct of writing a specification. |
| **Concrete anti-sniping / wallet-limit numbers** (spec §48-49) | The spec itself requires these be "economically simulated before implementation" — since the economic simulation above isn't built, no specific per-wallet min/max/cooldown numbers are proposed here rather than guessed. |
| **Creator bond / skin-in-the-game mechanism selection** (spec §51) | Same reasoning — a launch fee, bond, or reputation stake each needs the same simulation to size responsibly; "possible mechanism, not yet chosen" is the honest position. |
| **MEV mitigation beyond slippage/deadline protection** (spec §47) | `ITradingRouter`'s required `minAmountOut`/`deadline` parameters are real, concrete mitigations this spec defines. Solana-specific priority-fee/bundle-level MEV mitigation (e.g. Jito integration) is a real, chain-specific engineering decision deferred to actual implementation. |
| **A working deployment pipeline / CI-CD target** (spec §67) | No CI/CD target exists to deploy a program to — `.github/workflows/ci.yml` is unchanged by this sprint. The pipeline is described as policy (`14-audit-monitoring-and-deployment-pipeline.md`), not wired to anything that runs. |
| **A specific upgradeability policy per contract** (spec §36) | Deliberately left as "must be declared, one of four options" rather than assigning a policy now — that's an implementation-time decision informed by which contracts hold funds directly. |
| **Auto-expiring emergency pauses** | `IEmergencyController` has no time-bound auto-resume — matches the off-chain kill switch it mirrors, which also has no auto-expiry today. Flagged as a real open design question, not silently decided either way. |
| **Multi-chain deployment** | This sprint documents Solana as the only target chain (`01-architecture-and-chain-strategy.md`) — chain-abstraction is a design principle in the interfaces (plain-string addresses, a narrow `ChainId` type), not an actual second-chain build. |

## A note on scope discipline

Every item above was deliberately left out, not overlooked. Where a
cheaper, honest partial version was buildable (a real worked bonding-curve
example instead of a full economic model, required-not-optional slippage
and deadline parameters instead of a full MEV-mitigation build, a
type-checked event schema instead of a working indexer), it was built.
Where nothing honest could be built without a Rust/Anchor toolchain, real
deployed contracts, or external engagement this sprint doesn't have, it's
listed here instead of faked.
