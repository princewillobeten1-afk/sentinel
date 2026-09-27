/** Defense in depth, not a claim that regex can detect every kind of personal data. */
export function privacyViolation(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return /(?:private\s*key|seed\s*phrase|mnemonic|api[ _-]?key|password|bearer\s+|-----BEGIN|AIza[\w-]{20}|sk-[\w-]{12})/i.test(normalized)
    || /\b[1-9A-HJ-NP-Za-km-z]{80,}\b/.test(normalized)
    || /^\s*(?:\d+(?:\.\d+)?|\.\d+)\s*(?:SOL|USDC|USD|dollars?)\s*[.!]?\s*$/i.test(normalized)
    || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(normalized)
    || /\b(?:my|our|mine)\b.{0,45}\b(?:wallet|portfolio|balance|position|holdings|trades?|trading|bought|sold|profit|loss|name|address|phone|account)\b/i.test(normalized)
    || /\bI\s+(?:own|hold|bought|sold|lost|earned|invested|have|am|live)\b/i.test(normalized)
    || /\b(?:buy|sell|swap|spend|invest|trade|order|transfer|send)\b[^.!?\n]{0,55}(?:\d|\b(?:one|two|three|four|five|ten|hundred|thousand)\b)/i.test(normalized)
    || /\b(?:\d+(?:\.\d+)?|one|two|ten|hundred)\s*(?:SOL|USDC|USD|dollars?)\b[^.!?\n]{0,35}\b(?:buy|sell|swap|trade|order)\b/i.test(normalized)
    || /https?:\/\/\S*[?&](?:key|token|secret|password)=/i.test(normalized)
    || /\b(?:\d[ -]?){10,16}\b/.test(normalized)
    || /\b(?:[a-z]+\s+){11,23}[a-z]+\b/i.test(normalized) && /recovery|restore|backup.*words/i.test(normalized);
}

export function unsafeAnswer(text: string): boolean {
  return privacyViolation(text) || /\d|https?:|<[^>]*>|\b(?:birdeye|helius|quicknode|rugcheck|gemini|google|openai|anthropic)\b/i.test(text)
    || /guarantee|risk.free|is safe|will (?:pump|rug|rise|fall)|same owner|definitely|certainly|rug pull|honeypot|wash trad|insider (?:sold|bought)/i.test(text);
}
