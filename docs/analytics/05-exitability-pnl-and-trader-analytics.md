# 05 — Position Exitability, True Net P&L & Trader Analytics (Sprint 38 §27-37)

## 1. Position-Specific Exitability Simulation (§29-31)

A single token-level exitability score is insufficient because large positions face severe non-linear slippage. Sentinel computes multi-tier simulations across standard position sizes:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ POSITION-SPECIFIC EXITABILITY SIMULATION                                    │
├──────────────┬──────────────────┬─────────────────┬─────────────────────────┤
│ Position Size│ Price Impact %   │ Estimated Score │ Execution Status        │
├──────────────┼──────────────────┼─────────────────┼─────────────────────────┤
│ $100         │ 0.12%            │ 98 / 100        │ Safe Execution          │
│ $500         │ 0.60%            │ 92 / 100        │ Safe Execution          │
│ $1,000       │ 1.20%            │ 88 / 100        │ Safe Execution          │
│ $5,000       │ 5.80%            │ 68 / 100        │ Elevated Price Impact   │
│ $10,000      │ 11.20%           │ 42 / 100        │ Illiquid Trap           │
│ $50,000      │ 38.50%           │ 12 / 100        │ Severe Liquidity Drain  │
└──────────────┴──────────────────┴─────────────────┴─────────────────────────┘
```

---

## 2. True Net P&L Attribution Formula (§32-33)

Conventional portfolio dashboards report gross P&L, hiding significant fee and slippage losses. Sentinel calculates True Net P&L:

$$\text{Net P\&L} = \text{Gross Profit} - \text{DEX Fees} - \text{Network Gas} - \text{Slippage Cost} - \text{Price Impact Decay}$$

### Attribution Components:
- **DEX Trading Fees**: e.g., 25 bps Raydium/Orca pool swap fee.
- **Solana Gas & Priority Fees**: Execution transaction costs.
- **Slippage Drag**: Difference between quoted price and executed fill price.
- **Price Impact**: Asset depreciation incurred by the trade's own volume.

---

## 3. Trader Behavioral Self-Analytics & Habit Diagnosis (§36-37)

Provides traders with personalized diagnostic insights to improve profitability:
- **Speed**: Average entry latency after curve launch (e.g. 3.4 minutes).
- **Discipline**: Average hold duration and winner-to-loser gain asymmetry.
- **Loss Attribution**: What percentage of losses originated from low-exitability asset traps vs. chasing late-stage momentum pumps?
- **Constructive Feedback**: Observations framed objectively without judgmental language.
