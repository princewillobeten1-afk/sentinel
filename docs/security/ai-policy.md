# AI Security Policy

## Today's reality

No real AI/LLM integration exists anywhere in Project Sentinel's codebase as of this sprint.

- `components/views/ai-view.tsx` ("AI Co-Pilot" in the sidebar) is a pure client-side mock: it pushes the user's message, waits ~600ms via `setTimeout`, then displays a hardcoded canned string. No API call is made.
- `lib/intelligence/ai-interface.ts` is an explicit, labeled stub (its own docstring: *"Sprint 5 Stub... no LLM in Sprint 5"*). `generateAIExplanation()` string-templates the deterministic intelligence report — it does not call a model.
- Everything else in the codebase called "intelligence" (`lib/intelligence/**`, `lib/exitability/**`, `lib/ownership/**`, `lib/creator/**`) is deterministic rule- and formula-based scoring. "Intelligence" is this product's name for that system, not a claim that it's machine-learned.

This matters for scoping: there is no existing AI attack surface to secure (prompt injection, data poisoning, model manipulation) because there is no model. Building elaborate protection for a system that doesn't exist would be decorative, not real — the opposite of this sprint's intent.

## The one thing that does exist: a structural chokepoint

`lib/ai/policy.ts`'s `evaluateAiRecommendation()` exists so that **whenever** a real AI integration is added, it is structurally required to go through it before anything downstream acts on its output.

```
AI (future)
   │
   ▼
evaluateAiRecommendation()  ──▶  PolicyDecision { allowed, reasoning, requiresHumanConfirmation: true }
   │
   ▼
Human-facing UI  OR  a deterministic engine
(PreTradeRiskEngine, lib/server/kill-switch.ts, ...)
   │
   ▼
Execution (still gated by every other Sprint 30 control — risk engine, slippage
enforcement, kill switch, circuit breaker — regardless of what recommended it)
```

The key property: `PolicyDecision.requiresHumanConfirmation` is typed as the literal `true`, not `boolean`. No branch of `evaluateAiRecommendation()` can construct a decision with this set to `false` — it isn't a runtime check that a careless caller could ignore, it's a type the TypeScript compiler enforces. A future auto-executing AI path would have to bypass this function entirely to exist, which is the point: this function can only ever produce "AI recommends, something else decides."

## What this means when AI is actually added

- An AI-generated trade suggestion must still pass through `PreTradeRiskEngine.evaluate()`, slippage enforcement, and the kill switch — exactly like a human-initiated trade (`app/api/v1/execution/submit/route.ts`, `app/api/v1/trading/prepare/route.ts`). It gets no special exemption for being AI-originated.
- Explainability: any real recommendation should carry the model/version, the data timestamp it was computed from, and its confidence — matching the intent already implicit in `AiRecommendation`'s shape.
- Hallucination protection: an AI must not be allowed to invent wallet ownership, transaction history, contract permissions, or risk evidence. If real evidence isn't available, the honest output is "insufficient evidence," not a fabricated fact — this policy doesn't build that check today (there's nothing to check yet), but it's the standard any future evidence-bearing recommendation must meet before `evaluateAiRecommendation` is a reasonable gate for it.

## Explicitly out of scope this sprint

Prompt-injection defenses, training-data integrity, model-output validation heuristics, and adversarial-input handling are not built here — there is no prompt, no training data, and no model output to defend. Building them now would be speculative. When a real integration lands, threat-model it at that point against what's actually being built, not against a hypothetical shape guessed at today.
