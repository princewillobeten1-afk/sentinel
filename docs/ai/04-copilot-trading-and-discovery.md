# 04 — Trader Copilot, Pre-Trade Check & Discovery (Sprint 37 §21-24, §30-31, §65-67)

## 1. Context-Aware Trader Copilot (`lib/ai/copilot.ts`)

The Copilot automatically inherits the active screen context without requiring users to copy/paste contract addresses or transaction hashes:

```text
User viewing: Token ABC
User prompt:  "Why is this token risky?"
Copilot context: Automatically binds to ABC's active EvidencePackage
```

### Multi-Token Comparison (§21)
Users can ask: *"Compare token ABC with XYZ on exitability and holder concentration."*
The Copilot formats a side-by-side table and highlights comparative advantages grounded in deterministic metrics.

---

## 2. Pre-Trade Advisory Risk Check (§23-24)

When a user prepares an order (e.g. *"Buy $500 of ABC"*), the Copilot provides an instant pre-flight summary:

```text
TRADE CHECK: BUY $500 ABC

Token Risk: HIGH
Available Liquidity: $420k
Estimated Price Impact: 1.8%
Exitability Score: 41/100 (Constrained)

Potential concerns:
• Top 10 holders control 47% of effective supply
• Pool liquidity dropped 31% in the last 24h

[Review Trade in Terminal]
```

### Zero Autonomous Execution Guarantee (§23, §72-73)
The AI never signs transactions or submits orders directly to the blockchain. All consequential trade actions require explicit human confirmation and must pass the deterministic `PreTradeRiskEngine` and platform kill switches.

---

## 3. Natural Language Search to Deterministic Filter Compiler (§30)

Traders can discover opportunities using conversational prompts:
> *"Find newly launched tokens with growing organic volume, low insider concentration and at least $100k liquidity."*

The AI translates this into deterministic SQL/database filters:

```text
age_hours <= 24
AND organic_volume_pct >= 60
AND insider_concentration_score <= 30
AND total_liquidity_usd >= 100000
ORDER BY volume_24h_usd DESC
```

The database query engine executes the query. The AI NEVER fabricates or hallucinates candidate tokens.

---

## 4. Post-Trade Review & Learning Journal (`lib/ai/trade-journal.ts`)

Following trade settlement, the AI can summarize the execution for retrospective learning:

```text
POST-TRADE REVIEW: ABC (Trade #tr_4892)

Entry Price: $0.0021
Exit Price:  $0.0027
Result:      +28.5% (Net P&L: +$142.50 after $4.20 DEX fees)

What went well:
• Organic volume was expanding (>60%) prior to entry.
• Captured upward momentum with disciplined position sizing.

What could improve:
• Exitability score had deteriorated to 38/100 before the sell order was placed; exiting earlier would have reduced slippage.
```
