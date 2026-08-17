# 11 — Token Launchpad & Verifiable Reputation Architecture (Sprint 34 §57-60)

## 1. Token Launchpad Lifecycle Pipeline

```text
Creator Launch Request (Name, Symbol, Total Supply, Initial Liquidity, Lock Time)
                       │
                       ▼
Launch Configuration Validator (`lib/launchpad/risk.ts`)
                       │ (Enforces supply caps, liquidity lock minimums, fee limits)
                       ▼
Token Deployment Engine (`lib/blockchain/`)
                       │ (Mints SPL token, revokes freeze/mint authority if requested)
                       ▼
Liquidity Pool Setup & Lock Dispatch
                       │ (Deposits initial pair to Raydium/Meteora; locks LP tokens)
                       ▼
Immediate Monitoring & Discovery Injection
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
Discovery Scanner Feed          Intelligence Engine
(Tagged as "New Launch")        (Begins immediate cluster & volume tracking)
```

---

## 2. Launchpad Safety & Anti-Rug Invariants
- **Fixed Supply & Zero Infinite Minting**: Contract verification confirms mint authority is either revoked or bound to a deterministic bonding curve program.
- **Enforced Liquidity Locks**: Minimum 100% of initial paired SOL/USDC liquidity locked in a time-locked escrow contract for a minimum of 30 to 365 days.
- **Creator Allocation Caps**: Deployer wallet is restricted from holding >15% of total supply at launch. This cap is now also the TS-layer `lib/launchpad/risk.ts` scoring anchor as of Sprint 36 (reconciled from two other, conflicting thresholds found in the code at the time) — see [`docs/contracts/09-creator-accountability-and-reputation.md`](../contracts/09-creator-accountability-and-reputation.md).

---

## 3. Verifiable Multi-Entity Reputation Layer (`lib/trust/`)

```text
                      VERIFIABLE REPUTATION ENGINE
                                   │
        ┌──────────────────┬───────┴──────────┬──────────────────┐
        ▼                  ▼                  ▼                  ▼
Creator Track Record   Trader Track Record   Wallet Reputation  Community Signals
• Historic tokens      • Win rate & P&L      • Age & volume     • Flagging ratio
• Rug/abandon rate     • Sharpe ratio        • Cluster score    • Audit votes
• Liquidity behavior   • Copy follower base  • Sybil index      • Verified badges
```
- **Provenance Standard**: Reputation scores are derived exclusively from verifiable on-chain history (tx signatures, slot numbers, and account states), never from self-reported claims.
