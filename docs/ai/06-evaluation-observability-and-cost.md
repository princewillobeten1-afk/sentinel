# 06 — Evaluation, Observability & Cost Controls (Sprint 37 §47-56, §76)

## 1. Golden Evaluation Dataset & Continuous Benchmarking (§49, §76)

To maintain rigorous quality standards, all model and prompt updates are evaluated against a curated Golden Dataset:

### Evaluation Categories
1. **Known Safe Tokens**: Verified liquidity locks, decentralized holders, revoked authorities.
2. **Known Risky Tokens**: High holder concentration, serial drain deployers.
3. **Known Insider Patterns**: Multi-sig sniper clusters, coordinated wash sales.
4. **Known Liquidity Events**: Sudden liquidity drainage and exit collapse.
5. **Known Statistical Anomalies**: Uncharacteristic volume surges.

### Core Quality Metrics (§48, §76)
- **Grounding Score Target**: `> 90%` of all statements verifiable against underlying data.
- **Hallucination Rate Target**: `< 1.0%` on benchmark golden runs.
- **Regression Detection**: Continuous automated diffing preventing deployments that lower grounding scores.

---

## 2. Cost Controls & Token Budgeting (§54-56)

### Response Caching (§55)
Deterministic hashes of `(feature_id + prompt + evidence_snapshot_hash)` cache generated reports for 1 to 10 minutes, avoiding duplicate LLM calls on high-traffic tokens.

### Event-Driven Invalidation (§56)
Analyses are not regenerated continuously on fixed timers. An AI report is only re-computed when a material event occurs (e.g. pool liquidity drops $>10\%$, creator transfers $>2\%$ supply, or new cluster discovered).

### Domain Token Budgets (§54)
Each feature domain operates under strict token caps:
- `TOKEN_SUMMARY`: 100k tokens / day
- `TOKEN_ANALYSIS`: 250k tokens / day
- `COPILOT_CHAT`: 200k tokens / day
- `PORTFOLIO_ANALYSIS`: 150k tokens / day

---

## 3. Prompt & Model Versioning (§51-52)

Every AI response stores complete audit metadata:
```json
{
  "modelVersion": "claude-3-5-sonnet-20241022",
  "promptVersion": "TOKEN_ANALYSIS_V2",
  "dataSnapshotHash": "snap_9a87bf_So1111",
  "tokensConsumed": 384,
  "estimatedCostUsd": 0.00115,
  "latencyMs": 1340,
  "groundingScore": 0.94
}
```
