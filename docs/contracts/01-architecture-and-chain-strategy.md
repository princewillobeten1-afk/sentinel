# 01 — Smart-Contract Architecture & Chain Strategy

Spec §1-3.

## Contract inventory

| Contract | Role | TS interface |
|---|---|---|
| `TokenFactory` | Creates standardized tokens through a controlled process | `ITokenFactory` (`lib/contracts/token-factory.ts`) |
| `Launchpad` | Coordinates the token launch lifecycle | `ILaunchpad` (`lib/contracts/launchpad.ts`) |
| `LaunchController` | Pre-flight risk analysis, deploy/pause/resume/cancel a launch | `ILaunchController` (`lib/contracts/launchpad.ts`) |
| `BondingCurve` | Deterministic pre-graduation pricing curve | `IBondingCurve` (`lib/contracts/bonding-curve.ts`) |
| `LiquidityManager` | Migrates graduated-curve reserves to real DEX liquidity, locks it | `ILiquidityManager` (`lib/contracts/liquidity-manager.ts`) |
| `FeeController` | Computes and routes protocol/creator fee splits | `IFeeController` (`lib/contracts/fee-controller.ts`) |
| `Treasury` | Holds and disburses protocol-owned funds | `ITreasury` (`lib/contracts/treasury.ts`) |
| `AccessController` | Privileged-role grants for every other contract | `IAccessController` (`lib/contracts/access-controller.ts`) |
| `EmergencyController` | Scoped pause/resume | `IEmergencyController` (`lib/contracts/emergency-controller.ts`) |
| `TradingRouter` | Best-execution routing across `IDexAdapter`s | `ITradingRouter` (`lib/contracts/trading-router.ts`) |

## Call graph

```text
                         PROTOCOL
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
  TokenFactory          Launchpad          Treasury ◄── FeeController
        │                   │                              ▲
        │                   ▼                               │
        │           LaunchController ──────────────────────┘
        │                   │
        │           ┌───────┴───────┐
        │           ▼               ▼
        │     BondingCurve   LiquidityManager ──► TradingRouter ──► IDexAdapter (Raydium/Orca/…)
        │
        ▼
  Token contract (queried the same way for first- and third-party tokens — see 10-third-party-token-risk-flagging.md)
```

`AccessController` and `EmergencyController` sit alongside every contract above rather than in the call chain — every privileged method on every other interface takes an `actor: Address` and is expected to check `IAccessController.hasRole`/`IEmergencyController.isPaused` before proceeding, not call them as a pipeline step.

## Chain strategy

**Solana, first and only, for now.** Every existing product decision already commits to this: SPL tokens, Solana wallet connections, Birdeye's Solana-only market data, `NEXT_PUBLIC_SOLANA_RPC_URL`. Nothing in this sprint evaluates a second chain — that would be re-deriving a decision this codebase has already made in a dozen other places.

Chain-abstraction is a **documented interface principle**, not a multi-chain implementation:
- `lib/contracts/types.ts`'s `ChainId` is deliberately typed as the literal `'solana'`, not `string` — narrowing it, not widening it, is the honest reflection of "nothing calls this with a second chain today." Adding a chain later is a one-line type change, not a redesign.
- Every interface uses plain `string` for addresses/signatures (`Address`, `TxSignature`), never a Solana-specific SDK type like `PublicKey`. This matches the convention `lib/chain/adapter.ts` (Sprint 34) already established for its own, differently-scoped `ChainAdapter` interface — reused here rather than invented fresh.
- `ITradingRouter`/`IDexAdapter` (`08-trading-router-and-dex-adapters.md`) are adapter-based specifically so a second chain's DEXes could register new adapters without changing the router's own interface.

What this section does **not** do: evaluate throughput/cost/liquidity/RPC-reliability tradeoffs against other chains. That evaluation was already made by every prior sprint's architecture; redoing it here would be decorative.
