import { z } from 'zod';
import type { EvidenceFact, PilotAnswer } from './contracts';
import { buildInsights } from './insights';

/**
 * Analyst-style answers written by the model. Free prose is allowed, but it is
 * grounded server-side: every substantive section must cite measured evidence,
 * every number in the prose must match a measured fact, and advice / certainty /
 * provider language is rejected. Failures fall back to validated templates.
 */
export const NARRATIVE_TITLES = ['Verdict', 'Key findings', 'Risks', 'What to watch', 'Limitations'] as const;
const CITATION_REQUIRED = new Set(['Verdict', 'Key findings', 'Risks']);

export const narrativeSchema = z.object({
  sections: z.array(z.object({
    title: z.enum(NARRATIVE_TITLES),
    text: z.string().trim().min(1).max(1400),
    evidenceIds: z.array(z.string()).max(12).default([]),
  })).min(1).max(5),
});

const PROVIDERS = /\b(?:birdeye|helius|quicknode|rugcheck|gemini|google|openai|anthropic|nvidia|nemotron|llama|gpt)\b/i;
const ADVICE = /\b(?:guarantee[sd]?|risk[- ]free|is safe|totally safe|will (?:pump|rug|moon|rise|fall|crash|dump|go up|go down|recover|rebound)|(?:you|we) should (?:buy|sell|ape|enter|exit)|buy now|sell now|good (?:buy|entry)|price target|target price|financial advice|not financial advice|definitely|certainly|100x|same owner|insider (?:sold|bought)|honeypot|wash[- ]trad\w*|rug ?pull(?:ed)?)\b/i;
const SECRETS = /(?:private\s*key|seed\s*phrase|mnemonic|api[ _-]?key|password|bearer\s+|-----BEGIN|AIza[\w-]{20}|sk-[\w-]{12}|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
const LONG_BASE58 = /\b[1-9A-HJ-NP-Za-km-z]{32,}\b/;
/** Conventional indicator periods / thresholds and windows that may appear without a fact. */
const CONVENTIONAL = new Set([2, 10, 14, 20, 24, 30, 50, 70, 100, 200]);
const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

interface NumberToken { raw: string; value: number; tolerance: number; percent: boolean }

/** Extracts numeric claims, ignoring timeframe tokens such as `1m`, `24h`, `7d`. */
export function extractNumbers(text: string): NumberToken[] {
  const cleaned = text
    .replace(/(?<![\d.,$])\b\d{1,3}\s*(?:s|m|h|d|w|sec|[Mm]ins?|[Mm]inutes?|[Hh]rs?|[Hh]ours?|[Dd]ays?|[Ww]eeks?)\b/g, ' ')
    .replace(/\btop[- ]?\d{1,2}\b/gi, ' ');
  const out: NumberToken[] = [];
  const re = /(?<![\w.])([-+]?)\$?(\d[\d,]*(?:\.\d+)?|\.\d+)\s*([kKmMbBtT](?![a-zA-Z])|%)?/g;
  for (const m of cleaned.matchAll(re)) {
    const digits = m[2].replace(/,/g, '');
    const suffix = (m[3] ?? '').toLowerCase();
    const mult = MULTIPLIER[suffix] ?? 1;
    const decimals = digits.includes('.') ? digits.split('.')[1].length : 0;
    const base = Number(digits);
    if (!Number.isFinite(base)) continue;
    out.push({
      raw: m[0].trim(),
      value: base * mult * (m[1] === '-' ? -1 : 1),
      tolerance: 0.5 * 10 ** -decimals * mult,
      percent: suffix === '%',
    });
  }
  return out;
}

function matchesFact(token: NumberToken, values: number[]): boolean {
  const n = Math.abs(token.value);
  if (!token.percent && token.tolerance >= 0.5 && CONVENTIONAL.has(n)) return true;
  return values.some(v => {
    const a = Math.abs(v);
    const tol = Math.max(token.tolerance, a * 0.03);
    // Percentages may be expressed as 0-100 or as fractions.
    return Math.abs(n - a) <= tol || (token.percent && Math.abs(n - a * 100) <= Math.max(token.tolerance, a * 3));
  });
}

export type NarrativeResult = { answer: PilotAnswer; errors?: undefined } | { answer?: undefined; errors: string[] };

export function validateNarrative(raw: unknown, facts: EvidenceFact[]): NarrativeResult {
  const parsed = narrativeSchema.safeParse(raw);
  if (!parsed.success) return { errors: ['Response must be JSON {"sections":[{"title","text","evidenceIds"}]} using the allowed titles.'] };
  const known = new Map(facts.filter(f => f.value !== null).map(f => [f.id, f]));
  const numbers = facts
    .filter(f => f.status !== 'unavailable' && typeof f.value === 'number')
    .map(f => f.value as number);
  const errors: string[] = [];
  for (const s of parsed.data.sections) {
    const bad = s.evidenceIds.filter(id => !known.has(id));
    if (bad.length) errors.push(`${s.title}: unknown evidence ids ${bad.join(', ')}.`);
    if (known.size > 0 && CITATION_REQUIRED.has(s.title) && !s.evidenceIds.length) errors.push(`${s.title}: must cite at least one evidence id.`);
    if (/https?:|www\.|<[^>]*>/i.test(s.text)) errors.push(`${s.title}: no links or markup.`);
    if (PROVIDERS.test(s.text)) errors.push(`${s.title}: do not name data or AI providers.`);
    if (SECRETS.test(s.text) || LONG_BASE58.test(s.text)) errors.push(`${s.title}: do not include addresses, keys or personal data.`);
    const advice = s.text.match(ADVICE);
    if (advice) errors.push(`${s.title}: remove advice/certainty language ("${advice[0]}").`);
    const unsupported = extractNumbers(s.text).filter(t => !matchesFact(t, numbers)).map(t => t.raw);
    if (unsupported.length) errors.push(`${s.title}: numbers not found in measured evidence: ${unsupported.slice(0, 5).join(', ')}.`);
  }
  if (errors.length) return { errors };
  return {
    answer: {
      validated: true,
      sections: parsed.data.sections.map(s => ({ title: s.title, text: s.text, evidenceIds: [...new Set(s.evidenceIds)] })),
    },
  };
}

/** Compact evidence table given to the model for writing the final answer. */
export function evidenceDigest(facts: EvidenceFact[]): string {
  return JSON.stringify(facts.slice(0, 60).map(f => ({
    id: f.id, mint: f.mint, label: f.label, value: f.value, unit: f.unit, status: f.status, observedAt: f.observedAt,
  })));
}

/** Deterministic template answer used when the model's prose cannot be validated. */
export function templateAnswer(facts: EvidenceFact[]): PilotAnswer | null {
  const insights = buildInsights(facts);
  const specific = insights.filter(i => i.evidenceIds.length > 0);
  if (!specific.length) return null;
  const order = ['Overview', 'Evidence', 'Caution', 'Next step', 'Limitations'];
  const picked = [...specific].sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title)).slice(0, 5);
  return { validated: true, sections: picked.map(({ title, text, evidenceIds }) => ({ title, text, evidenceIds })) };
}
