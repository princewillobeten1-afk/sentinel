# 03 — Wallet Behavioral Profiling & Smart-Money Intelligence (Sprint 38 §17-20, §41-42)

## 1. 9-Class Behavioral Taxonomy (§18)

Wallets are classified strictly through observable transaction heuristics:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ WALLET BEHAVIORAL CLASSIFICATIONS                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SNIPER: Buys within 2 minutes of curve launch or liquidity addition      │
│ 2. EARLY_BUYER: Enters within the first 10 minutes of trading activity      │
│ 3. SCALPER: Rapid in-and-out holding duration (average hold <= 15 minutes)  │
│ 4. MOMENTUM_TRADER: Enters accelerating volume/price trends                 │
│ 5. WHALE: Position size >= $25,000 in a single transaction                  │
│ 6. LIQUIDITY_PROVIDER: Interacts primarily with liquidity pool mint/burn    │
│ 7. MARKET_MAKER: Continuous two-sided order placement                      │
│ 8. LONG_TERM_HOLDER: Average holding duration exceeds 24 hours              │
│ 9. HIGH_FREQUENCY_TRADER: > 50 executions across diverse tokens per session│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Wallet Clustering & Epistemic Disclaimer (§19-20)

### Clustering Signals:
- Common funding parents (shared SOL gas distribution).
- Synchronized order timing across multiple mints ($>0.80$ correlation).
- Shared counterparties and internal asset transfers.

### Mandatory Compliance Disclaimer:
> **Clustering represents statistical and behavioral transaction similarity. It does not constitute legal proof of singular real-world ownership unless confirmed by verified on-chain cryptographic signatures.**

---

## 3. Smart-Money Tracking & Confidence (§41-42)

Rather than naively labeling large capital whales as "smart money", Sentinel applies strict performance criteria:
- **Historical Win Rate**: $\ge 65\%$ on $\ge 10$ closed trades.
- **Realized P&L**: $\ge \$10,000$ cumulative net profit.
- **Entry Precision**: High percentage of entries occurring before the median peak market cap.

**Multi-Wallet Coordinated Entry Signal**:
When $\ge 3$ historically profitable wallets accumulate the same token within 10 minutes, a `SMART_MONEY_ACCUMULATION` signal is dispatched with `HIGH` confidence.
