# 01 — AI Architecture & AI Gateway (Sprint 37 §1-5, §57-59)

## 1. Executive Principle

> **AI does not replace the intelligence engines. AI explains, combines, prioritizes, and assists using verified underlying data.**

The platform enforces a strict epistemic decoupling between immutable blockchain facts and probabilistic LLM reasoning. Under no circumstances will the system state *"this token is safe"* simply because an LLM produced a confident generation.

---

## 2. End-to-End Topology

```text
                         USER
                           │
                           ▼
                    AI EXPERIENCE (Terminal / Copilot / Audit Cards)
                           │
                           ▼
                      AI GATEWAY
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
       Model Router   Context Builder   Policy Engine
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    EVIDENCE LAYER
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 Token Intelligence   Wallet Intelligence   Market Data
 (Holders, Taxes)    (Clusters, Snipers)  (Liquidity, Vol)
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                     AI MODELS
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Analysis      Explanation    Copilot
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                    VALIDATION LAYER
             (Evidence Grounding & Claim Audit)
                           │
                           ▼
                     USER RESPONSE
```

---

## 3. Unified Internal AI Gateway (`lib/ai/gateway.ts`)

All AI requests throughout the application must transit a single gateway pipeline:

```text
AI Request
    ↓
Authentication & Authorization (Verify scopes & RBAC)
    ↓
Rate Limiting & Token Budgeting (Enforce monthly domain limits)
    ↓
Prompt Injection Sanitization (Wrap untrusted metadata in <untrusted_content>)
    ↓
Context Selection (Construct deterministic EvidencePackage)
    ↓
Model Selection (Router matches Category, SLA, & Cost)
    ↓
Inference Execution (Provider dispatch: Anthropic, Google, Local Stub)
    ↓
Claim Validation (Evidence Checker audits numerical claims & citations)
    ↓
Response Delivery & Caching (Cache valid answers for configured TTL)
```

Direct calls from UI views or background jobs to third-party model providers are strictly forbidden.

---

## 4. Model Router & Categories (`lib/ai/model-router.ts`)

The Model Router is provider-agnostic and categorizes inference tasks into 5 operational classes:

| Category | Typical Task | SLA Latency Target | Example Engine |
| :--- | :--- | :--- | :--- |
| **FAST_MODEL** | Token summary, "What Changed?", NL search filter compile | `< 2 seconds` | Gemini 1.5 Flash / Claude 3.5 Haiku |
| **REASONING_MODEL** | Multi-factor token audit, Copilot compare, Portfolio analysis | `< 5 seconds` | Claude 3.5 Sonnet / Gemini 1.5 Pro |
| **EMBEDDING_MODEL** | Token semantic similarity, creator clustering | `< 200 ms` | Text-Embedding-004 |
| **CLASSIFICATION_MODEL** | Fast binary/enum risk tagging, anomaly triage | `< 100 ms` | Sentinel Classifier v1 |
| **SPECIALIZED_MODEL** | Zero-hallucination deterministic fallback rules | `< 20 ms` | Sentinel Local Rule Stub |

---

## 5. AI Latency SLAs, Availability & Graceful Fallback

### Latency Targets (§57)
- **Simple explanations & summaries**: `< 2.0s`
- **Complex multi-token analysis**: `< 5.0s`
- **Streaming UI**: Initial token chunks rendered within `< 600ms`.

### High Availability & Offline Fallback (§58-59)
If upstream AI providers (Google Vertex, Anthropic, OpenAI) experience outages or rate limiting:
1. **Core Operations Continue Uninterrupted**: Trading, discovery feeds, portfolio accounting, and order execution never depend on AI availability.
2. **Deterministic Risk Fallback**: The UI renders deterministic risk scores (Exitability Score, Top 10 Holder %, Organic Volume %) directly from the underlying data engines with a badge: `Deterministic Signals (AI Unavailable)`.
