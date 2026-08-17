# 01 — Analytics Architecture, Data Pipeline & Lineage (Sprint 38 §1-9)

## 1. End-to-End Analytics Topology

```text
                     BLOCKCHAIN DATA (Solana RPC, Geyser, AMMs)
                                   │
                                   ▼
                            DATA INGESTION
                     (Helius, Birdeye, QuickNode)
                                   │
                                   ▼
                             DATA PIPELINE
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
         Raw Events        Normalized State       Event Bus
       (Blocks, Txs)      (Balances, Pools)      (Tier 1/2/3)
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   ▼
                           ANALYTICS ENGINES
    ┌──────────────┬──────────────┬──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼
  Market         Volume         Wallet        Creator        Trader
Analytics    Decomposition    Clustering     Outcomes    Self-Analytics
 (Price/Regime) (Wash vs Org)   & Smart $     & Rep      (P&L / Habits)
    │              │              │              │              │
    └──────────────┴──────────────┼──────────────┴──────────────┘
                                   ▼
                       POSITION EXITABILITY & RISK
                   (Multi-Size Impact Simulations)
                                   │
                                   ▼
                           INTELLIGENCE LAYER
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
      Discovery Matrix       Smart Alerts          AI Layer
    (Multi-Mode Ranking)   (Trigger Signals)   (Grounded Evidence)
             │                     │                     │
             └─────────────────────┼─────────────────────┘
                                   ▼
                       USER & ANALYTICS TERMINAL
```

---

## 2. Core 5-Stage Analytics Transformation Principle (§2)

The system enforces strict separation across five analytical abstraction layers:

```text
RAW DATA  →  Observed on-chain transaction: "Wallet 7xK... bought 4.2M tokens for 32 SOL"
   ↓
METRICS   →  Quantitative baseline: "Wallet owns 3.7% of circulating token supply"
   ↓
SIGNALS   →  Qualitative deduction: "High individual holder concentration"
   ↓
SCORES    →  Calibrated rating: "Ownership Risk = 72/100"
   ↓
INSIGHTS  →  Actionable advisory: "Large wallet concentration creates elevated sell-pressure risk."
```

---

## 3. Real-Time Recalculation Tiers (§56)

To maintain sub-second performance while computing deep analytical relationships, recalculations are tiered:

| Recalculation Tier | Metrics Computed | Trigger Event | SLA Latency |
| :--- | :--- | :--- | :--- |
| **Tier 1: Immediate** | Price, Pool Liquidity, 10-Way Volume, Trade Count, Price Impact | Block tick / DEX swap event | `< 100ms` |
| **Tier 2: Near-Real-Time** | Holder Retention, Effective Ownership, Exitability Curve, Risk Scores | Periodic 5s window or $>\$10\text{k}$ trade | `< 1.5s` |
| **Tier 3: Batch** | Creator Reputation Dataset, Long-Term Trader Analytics, Backtests | Hourly / Daily rollups | Background |

---

## 4. Timestamp Strategy & Latency Measurement (§8)

Every processed analytical item maintains four distinct timestamps to isolate pipeline bottlenecks:
1. `block_time`: Exact Solana block / slot timestamp from the validator header.
2. `observed_at`: Epoch millisecond when the event was ingested by our WebSocket RPC node.
3. `processed_at`: Epoch millisecond when the event passed normalization and deduplication.
4. `calculated_at`: Epoch millisecond when composite risk and exitability scores finished evaluating.

**Ingestion Lag Calculation**:
$$\text{Ingestion Lag} = \text{calculated\_at} - \text{observed\_at}$$

---

## 5. Bidirectional Data Lineage & Provenance (§7)

Traders can inspect the exact backwards lineage of any score:

```text
INSIGHT: "High Exitability Risk"
   ↓
SCORE: Exitability Score = 32/100
   ↓
SIGNAL: Pool quote depth insufficient for standard $5k position
   ↓
METRIC: Raydium CPMM reserve = $38,400 USDC
   ↓
NORMALIZED EVENT: Transfer 450 SOL out of pool
   ↓
TRANSACTION: 0x9f8e...3d2a (Instruction #2 RaydiumWithdraw)
   ↓
RAW BLOCK: Solana Block #294,819,201
```
