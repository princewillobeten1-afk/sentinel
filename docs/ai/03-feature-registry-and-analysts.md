# 03 — Feature Registry & Specialized Analysts (Sprint 37 §6-20, §32-34)

## 1. AI Feature Registry (`lib/ai/feature-registry.ts`)

Every AI capability is formally registered with strict operational constraints:

```typescript
aiFeatureRegistry.getFeature('TOKEN_SUMMARY');
// Returns:
// {
//   featureId: 'TOKEN_SUMMARY',
//   modelCategory: 'FAST_MODEL',
//   modelPolicy: 'TOKEN_SUMMARY_V2',
//   maxLatencyMs: 2000,
//   maxCostUsd: 0.005,
//   maxTokens: 300,
//   cacheTtlSeconds: 300
// }
```

This prevents uncontrolled token usage, runaway infrastructure costs, and unbounded model execution.

---

## 2. Token AI Analyst (`lib/ai/token-analyst.ts`)

The Token Analyst allows traders to inspect any token mint and ask natural-language questions:
- *"Is there anything suspicious here?"*
- *"Why is this token risky?"*
- *"Who appears to control the supply?"*
- *"Can I realistically exit this position?"*
- *"What changed in the last 10 minutes?"*

### Standard 12-Section Token Report Structure (§15)
1. **TOKEN OVERVIEW**: Symbol, market cap, active status.
2. **MARKET**: Price, volume, 24h change.
3. **LIQUIDITY**: Pool depth, lock status, slippage curve.
4. **OWNERSHIP**: Top 10 holder %, creator cluster share.
5. **CREATOR**: Deployer address, reputation score, past track record.
6. **VOLUME QUALITY**: Organic volume %, wash trading probability.
7. **INSIDER ACTIVITY**: Sniper count, cluster transfer flags.
8. **EXITABILITY**: Exitability Score (0-100), max recommended single sell size.
9. **CONTRACT**: Mint/freeze revocation, transfer taxes, honeypot test.
10. **RISK SUMMARY**: Overall risk rating, positive factors, warning factors, main concern.
11. **WHAT CHANGED**: Deltas across 15m/1h/24h.
12. **WHAT TO WATCH**: Key trigger levels and monitor points.

---

## 3. "What Changed?" State Diff Engine (`lib/ai/what-changed.ts`)

Instead of requiring traders to manually inspect charts, the "What Changed?" engine compares snapshots across `15m`, `1h`, and `24h` intervals:

```text
WHAT CHANGED — LAST 15 MINUTES

⚠ Liquidity decreased 19% ($520k → $420k).
⚠ Top 10 holder concentration increased by +4.2%.
⚠ Creator-linked wallets transferred tokens to secondary addresses.
✓ Unique traders increased 14%.
⚠ Exitability fell from 67 → 51.

Overall:
Risk has increased materially over the inspection window.
```

---

## 4. AI Anomaly Synthesizer (`lib/ai/anomaly-explainer.ts`)

Translates statistical anomalies (volume surges, liquidity drainage, wallet cluster accumulation) into plain English without inventing phantom signals.

### Strict Statistical Requirement (§20)
An anomaly requires measurable evidence (e.g. standard deviation $\ge 2.5\sigma$ from rolling 7-day baseline). The AI explains the detected deviation; it never invents an anomaly out of thin air.

---

## 5. Creator & Wallet Analysts (`lib/ai/creator-analyst.ts`, `lib/ai/wallet-analyst.ts`)

### Creator History Analyst (§32)
Audits the deployer's complete historical portfolio:
- Prior token deployments and outcome distribution (Graduated vs Liquidity Drains).
- Connected funding addresses and creator reputation score.

### Wallet Behavioral Profiler (§33-34)
Distinguishes between **Observed Facts** (e.g. entered 42 tokens in first 5 minutes) and **AI Inferences** (e.g. sniper bot profile with medium confidence).
