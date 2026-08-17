/**
 * Untrusted Content Pipeline & Prompt Injection Defense (Sprint 37 §69-70).
 *
 * Implements strict boundary enforcement for all external, user-supplied,
 * or on-chain text fields (token names, symbols, descriptions, websites, social links).
 *
 * Prevents adversarial attempts to override system instructions or extract keys.
 */

export interface SanitizedContent {
  raw: string;
  sanitized: string;
  isUntrustedWrapped: string;
  potentialInjectionDetected: boolean;
  strippedPatterns: string[];
}

export class PromptInjectionSanitizer {
  // Common prompt injection attack patterns
  private static readonly INJECTION_PATTERNS: Array<{ regex: RegExp; name: string }> = [
    { regex: /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, name: 'IGNORE_PREVIOUS_INSTRUCTIONS' },
    { regex: /system\s*:\s*you\s+are\s+now/gi, name: 'SYSTEM_ROLE_OVERRIDE' },
    { regex: /print\s+(all\s+)?(api\s*key|private\s*key|seed\s*phrase|secret)/gi, name: 'KEY_EXTRACTION_ATTEMPT' },
    { regex: /disregard\s+(the\s+)?(safety|rules|constraints|system)/gi, name: 'DISREGARD_SAFETY_RULES' },
    { regex: /you\s+are\s+DAN|jailbreak|developer\s+mode/gi, name: 'JAILBREAK_ATTEMPT' },
    { regex: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, name: 'EMBEDDED_HTML_SCRIPT' },
    { regex: /output\s+only\s+JSON\s+with\s+no\s+filter/gi, name: 'FILTER_BYPASS_INSTRUCTION' },
  ];

  /**
   * Sanitizes external untrusted string, stripping dangerous control sequences
   * and wrapping it in explicit untrusted data markers.
   */
  public static sanitizeExternalText(input: string, sourceLabel = 'external_metadata'): SanitizedContent {
    if (!input || typeof input !== 'string') {
      return {
        raw: '',
        sanitized: '',
        isUntrustedWrapped: `<untrusted_content source="${sourceLabel}"></untrusted_content>`,
        potentialInjectionDetected: false,
        strippedPatterns: [],
      };
    }

    let sanitized = input.trim();
    const strippedPatterns: string[] = [];
    let injectionDetected = false;

    // 1. Check & neutralize injection patterns
    for (const { regex, name } of this.INJECTION_PATTERNS) {
      if (regex.test(sanitized)) {
        injectionDetected = true;
        strippedPatterns.push(name);
        sanitized = sanitized.replace(regex, `[REDACTED_ATTEMPT: ${name}]`);
      }
    }

    // 2. Normalize whitespace and prevent invisible unicode exploit characters
    sanitized = sanitized
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width spaces
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
      .replace(/\s+/g, ' ');

    // 3. Bound string length to prevent prompt stuffing
    const MAX_UNTRUSTED_LENGTH = 1000;
    if (sanitized.length > MAX_UNTRUSTED_LENGTH) {
      sanitized = sanitized.slice(0, MAX_UNTRUSTED_LENGTH) + '...[TRUNCATED]';
    }

    // 4. Wrap in strict semantic untrusted tag (§70)
    const isUntrustedWrapped = `<untrusted_content source="${sourceLabel}" injection_flag="${injectionDetected}">\n${sanitized}\n</untrusted_content>`;

    return {
      raw: input,
      sanitized,
      isUntrustedWrapped,
      potentialInjectionDetected: injectionDetected,
      strippedPatterns,
    };
  }

  /**
   * Sanitizes metadata objects before passing into AI Context Builder.
   */
  public static sanitizeMetadataRecord(
    metadata: Record<string, any>,
    source = 'token_metadata'
  ): Record<string, any> {
    const sanitizedObj: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        sanitizedObj[key] = this.sanitizeExternalText(value, `${source}.${key}`).sanitized;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitizedObj[key] = this.sanitizeMetadataRecord(value, `${source}.${key}`);
      } else {
        sanitizedObj[key] = value;
      }
    }

    return sanitizedObj;
  }
}
