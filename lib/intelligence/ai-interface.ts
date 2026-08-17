/**
 * AI Explanation Interface (Sprint 5 Stub)
 *
 * The authoritative system is:
 *   Structured data → Deterministic intelligence → Risk signals → Score → Evidence → Optional AI explanation
 *
 * AI may later summarize the report in natural language, but it must not invent evidence.
 * This interface prepares the contract for future AI integration.
 */

import type { AIExplanationInput, AIExplanationOutput, TokenIntelligenceReport } from './types';

/**
 * Prepare an AI explanation input from a structured intelligence report.
 * The AI layer must receive the evidence rather than independently inventing facts.
 */
export function prepareAIInput(
  report: TokenIntelligenceReport,
  audience: AIExplanationInput['audience'] = 'intermediate',
  maxLength = 500,
): AIExplanationInput {
  return {
    report,
    audience,
    maxLength,
  };
}

/**
 * Stub: Generate an AI explanation.
 * In Sprint 5 this returns a structured-data-based summary.
 * Future sprints will connect this to an LLM with the structured report as context.
 */
export function generateAIExplanation(input: AIExplanationInput): AIExplanationOutput {
  const { report } = input;

  // Build a summary from the structured data (no LLM in Sprint 5)
  const highlights: string[] = [];
  const citedSignalIds: string[] = [];

  // Top warnings
  for (const w of report.warnings.slice(0, 3)) {
    highlights.push(`⚠️ ${w.evidence[0]?.fact || w.type}`);
    citedSignalIds.push(w.id);
  }

  // Top positives
  for (const p of report.positives.slice(0, 3)) {
    highlights.push(`✓ ${p.evidence[0]?.fact || p.type}`);
    citedSignalIds.push(p.id);
  }

  // Missing data note
  if (report.missingData.length > 0) {
    highlights.push(
      `ℹ️ ${report.missingData.length} data point(s) unavailable — confidence may be limited`
    );
  }

  const summary = [
    `${report.token.symbol} scores ${report.overallScore}/100 with ${report.confidence.score}% confidence.`,
    report.warnings.length > 0
      ? `There ${report.warnings.length === 1 ? 'is' : 'are'} ${report.warnings.length} area(s) of concern.`
      : 'No significant concerns detected.',
    report.positives.length > 0
      ? `${report.positives.length} positive indicator(s) observed.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    summary,
    highlights,
    citedSignalIds,
    generatedAt: new Date().toISOString(),
    disclaimer:
      'This summary is generated from structured intelligence data. It is not a financial recommendation. Always review the underlying evidence.',
  };
}
