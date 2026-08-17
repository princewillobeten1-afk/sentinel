# 05 — Safety Boundaries, Security & Personalization (Sprint 37 §25-29, §40-41, §68-73)

## 1. Epistemic Taxonomy: FACT vs ANALYSIS vs ESTIMATE vs PREDICTION (§41)

To prevent financial misrepresentation, all generated statements adhere to explicit categories:

```text
FACT:
"Pool liquidity is $420,000 and top 10 holders control 47% of supply."

ANALYSIS:
"Holder concentration is elevated relative to average launchpad depth."

ESTIMATE:
"A $10,000 sell order may cause approximately 8.5% price impact."

PREDICTION:
"Future token price trajectories cannot be reliably predicted."
```

---

## 2. Hard AI Safety Boundaries (§40)

The AI model is programmatically constrained from performing any of the following:
1. Requesting private keys or seed phrases.
2. Storing or caching private credentials.
3. Claiming guaranteed financial profits or certainty about future prices.
4. Fabricating fictitious blockchain transactions or wallet relationships.
5. Falsely reporting that a transaction succeeded when it failed.

---

## 3. Untrusted Content Pipeline & Prompt Injection Defense (§69-70)

External token metadata (descriptions, names, social media bios, website texts) can contain adversarial prompt injection payloads designed to override LLM system constraints.

### Sanitization Pipeline (`lib/ai/sanitizer.ts`)
```text
External Token Metadata
          │
          ▼
PromptInjectionSanitizer
          │ (Redacts instruction override attempts, control sequences & script tags)
          ▼
Wrap in Strict Semantic Boundary
`<untrusted_content source="token_metadata"> ... </untrusted_content>`
          │
          ▼
AI Model Prompt Context
```

---

## 4. Personalized Risk Profiles & User Rules (`lib/ai/risk-rules-ai.ts`)

Traders can configure personalized risk boundaries that override conversational outputs:

| Profile | Min Exitability | Max Top 10 Holder % | Max Insider Score | Require Mint Revoked |
| :--- | :--- | :--- | :--- | :--- |
| **Conservative** | `65` | `35%` | `25` | `Yes` |
| **Balanced** | `50` | `45%` | `40` | `Yes` |
| **Aggressive** | `30` | `60%` | `65` | `No` |
| **Custom** | *Configurable* | *Configurable* | *Configurable* | *Configurable* |

### Pre-Trade Rule Violation Handling (§25)
If a trader attempts an order on a token violating their configured profile:
> *"This trade conflicts with your personal risk rule (Token Exitability is 41, below your configured minimum of 60)."*

---

## 5. Natural-Language Alert Translation (§29)

Users can create rules such as:
> *"Tell me when a token I am holding experiences a major liquidity drop."*

The AI compiles this into a deterministic trigger condition:
`pool_liquidity_change_24h <= -20%`
The actual background event monitoring is executed by the deterministic event bus and rule engine, not by continuously polling an LLM.
