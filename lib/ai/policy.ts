/**
 * AI output policy chokepoint (Sprint 30 — Tier 8).
 *
 * No real AI/LLM integration exists anywhere in this codebase today —
 * `components/views/ai-view.tsx` ("AI Co-Pilot") is a client-side mock
 * (`setTimeout` + a canned string, no fetch call at all), and
 * `lib/intelligence/ai-interface.ts` is an explicit unimplemented stub
 * ("Sprint 5 Stub... no LLM in Sprint 5"). Everything else called
 * "intelligence" in this codebase (`lib/intelligence/**`) is deterministic
 * rule/scoring logic, not a model.
 *
 * This file exists anyway, small and bounded, so that whenever a real AI
 * integration is added, it is structurally required to go through this
 * chokepoint rather than acting directly: `evaluateAiRecommendation()` never
 * executes anything itself — it only ever returns a decision for a
 * human-facing UI or a deterministic engine (`PreTradeRiskEngine`,
 * `lib/server/kill-switch.ts`, etc.) to act on. See
 * `docs/security/ai-policy.md`.
 */

export type AiRecommendationKind = 'TRADE_SUGGESTION' | 'RISK_FLAG' | 'PORTFOLIO_ADVICE';

export interface AiRecommendation {
  id: string;
  kind: AiRecommendationKind;
  summary: string;
  confidence: number;
  suggestedAt: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reasoning: string[];
  /**
   * Always the literal `true` — not `boolean`. This is a structural, not
   * just runtime, guarantee: no branch of `evaluateAiRecommendation` can
   * construct a `PolicyDecision` with this set to `false`, so no future
   * caller can (even accidentally) skip human confirmation by relying on
   * this function's output. A real auto-execution path would have to
   * bypass this function entirely, which is the point — it makes "AI
   * recommends, a human or a deterministic engine decides" the only
   * path this function can produce.
   */
  requiresHumanConfirmation: true;
}

export function evaluateAiRecommendation(rec: AiRecommendation): PolicyDecision {
  const reasoning: string[] = [];

  if (rec.confidence < 0 || rec.confidence > 1) {
    return {
      allowed: false,
      reasoning: [`Confidence ${rec.confidence} is outside the valid [0, 1] range — treating as untrustworthy.`],
      requiresHumanConfirmation: true,
    };
  }

  reasoning.push(`Recommendation (${rec.kind}) evaluated — confidence ${rec.confidence.toFixed(2)}.`);
  reasoning.push('AI recommendations never execute directly: this decision is advisory only. A trade suggestion still passes through PreTradeRiskEngine and the platform kill switch like any other trade; a risk flag or portfolio advice is presented to the user, not acted on automatically.');

  return {
    allowed: true,
    reasoning,
    requiresHumanConfirmation: true,
  };
}
