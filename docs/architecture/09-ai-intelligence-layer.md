# 09 — AI Intelligence Layer & AI Gateway (Sprint 34 §43-46)

## 1. Two-Tier Decoupled Intelligence Principle
Project Sentinel structurally separates immutable blockchain facts from probabilistic AI inferences:

```text
RAW BLOCKCHAIN DATA
        │ (Immutable truth: Transfers, Mints, DEX Swaps, Balances)
        ▼
DETERMINISTIC INTELLIGENCE ENGINES
        │ (Calculates exact ownership %, cluster graphs, and exit depth)
        ▼
FEATURE SET & FACT SNAPSHOT
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
[VERIFIED FACTS LAYER]           [AI EXPLANATION LAYER]
• "Creator sold 42% supply"       • "High correlation with pre-rug
• "Mint authority revoked"           liquidity drainage patterns."
• "Pool locked for 180 days"      • Human-readable synthesis
```

- **Safety Rule**: AI models never execute trades or make automated financial decisions directly. They provide contextual risk explanations and market narratives to assist human traders.

---

## 2. Multi-Model AI Gateway Architecture (`lib/ai/gateway.ts`)

```text
Application Services (Trading Co-Pilot, Risk Explainer, Token Summarizer)
                             │
                             ▼
                    SENTINEL AI GATEWAY
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
Prompt Deduplication    Domain Token Budget     Priority Router
    Cache (Redis)        & Rate Limiter          (P0 / P1 / P2)
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             │
                             ▼
                       MODEL ROUTER
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   Primary LLM          Secondary LLM       Deterministic
(Claude 3.5 Sonnet)   (Gemini 1.5 Pro)      Fallback Stub
```

---

## 3. AI Cost & Reliability Controls
- **Response Caching**: Deterministic hashes of `(prompt + contextData)` cache responses for 5 minutes, preventing redundant LLM calls on high-traffic tokens.
- **Domain Token Budgets**: Monthly token limits configured per domain (`trading_copilot: 100k`, `risk_explanation: 250k`, `token_summary: 50k`).
- **Never Fabricate Policy**: If all upstream LLM APIs fail or timeout, the gateway returns clean `"AI analysis unavailable"` status while continuing to display all verified on-chain facts.
