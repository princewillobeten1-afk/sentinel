# 03 — Feature Store Architecture & Data Lineage (Sprint 35 §79-80)

## 1. Intelligence Feature Store Architecture

Rather than recomputing expensive graph traversals on every user query, Project Sentinel maintains a pre-aggregated feature store (`lib/activity/feature-store.ts`):
- `token_features`: 5m/1h/24h volume acceleration, unique buyer/seller ratios, liquidity volatility, exit depth.
- `wallet_features`: Sybil clustering score, funding source links, average holding time, past dump behavior.
- `creator_features`: Historical token count, rug incidence rate, average liquidity lock duration.

---

## 2. End-to-End Data Lineage & Reproducibility Guarantee

Every intelligence score and risk report must be 100% reproducible and traceable to its root evidence:

```text
BLOCKCHAIN EVENT (Slot 289104000, TxHash 5Kj8xWv...)
        │
        ▼
NORMALIZED DATA (Token So111..., Swap Amount 10.5 SOL)
        │
        ▼
FEATURE STORE (Cluster holding: 31%, Organic volume: 42%)
        │
        ▼
INTELLIGENCE ENGINES (Ownership, Creator, Exitability)
        │
        ▼
AGGREGATED RISK SCORE (82/100, Confidence: 88%)
        │
        ▼
EXPLAINABLE FACTORS & AI REPORT
• [✓] Liquidity locked for 180 days
• [⚠] Creator dumped 45% of supply
• [⚠] Insider cluster controls 31%
```

- **Black-Box Prohibition**: No intelligence score is ever displayed as an isolated number. It must always link to verifiable on-chain evidence (`lib/db/lineage.ts`).
