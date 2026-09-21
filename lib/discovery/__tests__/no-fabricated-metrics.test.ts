import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards against numeric fallbacks reappearing on the feed card.
 *
 * Every value below was a literal constant shipping on **every** token:
 *
 *     snipersPct  = token.sniperPercentage      ?? (auditPending ? null : 4)
 *     insidersPct = token.insiderHoldingsPct    ?? (auditPending ? null : 2)
 *     bundlerPct  = token.bundlerPercentage     ?? (auditPending ? null : 0)
 *     top10       = token.top10HoldingsPct      ?? 22
 *     proTraders  = ... ?? Math.floor((holdersCount ?? 40) * 0.12)
 *     kols        = ... ?? Math.floor((holdersCount ?? 20) * 0.04)
 *     visitors    = ... ?? (hash(mint.slice(-4)) % 180) + 12
 *     followers   = (hash(handle) * 47) % 85000 + 1200
 *     devRecord   = '1/1'
 *     feeAccrued  = volume * 0.01
 *
 * `auditPending` is set by nothing in any live path, so the constants always
 * won. Against the card's own thresholds (snipers >10, insiders >5, bundlers
 * >5, top-10 >30) all four rendered **green** — every token in the feed
 * advertised a clean audit that nothing had performed.
 *
 * A source-level assertion is deliberate: these were one-line fallbacks that a
 * rendering test would have to guess its way to. The pattern is what must not
 * come back.
 */
const CARD = join(process.cwd(), 'components', 'discovery', 'token-card.tsx');

function source(): string {
  return readFileSync(CARD, 'utf8');
}

/** Strips block and line comments so documented history is not re-flagged. */
function code(): string {
  return source()
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('token card renders no fabricated metrics', () => {
  it('has no numeric fallback for any audit percentage', () => {
    const body = code();
    for (const field of [
      'sniperPercentage',
      'insiderHoldingsPct',
      'bundlerPercentage',
      'top10HoldingsPct',
      'devHoldingsPct',
    ]) {
      // `?? <number>` or `?? (… : <number>)` — the shapes that shipped.
      const fallback = new RegExp(`${field}\\s*\\?\\?[^;\\n]*\\b\\d`);
      expect(body, `${field} must not fall back to a literal`).not.toMatch(fallback);
    }
  });

  it('does not derive crowd metrics from the holder count', () => {
    const body = code();
    expect(body).not.toMatch(/holdersCount\s*\?\?\s*\d+\s*\)\s*\*/);
    expect(body).not.toMatch(/\*\s*0\.12/);
    expect(body).not.toMatch(/\*\s*0\.04/);
  });

  it('does not hash anything into a metric', () => {
    // Both the follower count and the visitor count were character-code sums.
    const body = code();
    expect(body).not.toMatch(/charCodeAt[\s\S]{0,200}%\s*\d{2,}/);
    expect(body).not.toMatch(/\*\s*47\s*\)\s*%\s*85000/);
  });

  it('does not default the deployer record to a perfect score', () => {
    expect(code()).not.toMatch(/return\s*'1\/1'/);
  });

  it('does not invent a boost countdown from token age', () => {
    const body = code();
    expect(body).not.toMatch(/360\s*-\s*token\.ageMinutes\s*\*\s*60/);
    expect(body).not.toMatch(/isBoosted\s*\)\s*return\s*300/);
  });

  it('does not compute fees as a fixed share of volume', () => {
    expect(code()).not.toMatch(/volumeDisplay\s*\)\s*\*\s*0\.01/);
  });

  it('routes unknown metrics through MetricValue rather than a bare dash', () => {
    const body = code();
    expect(body).toContain('MetricValue');
    // The four-state helper is what distinguishes a real 0% from "not measured".
    expect(body).toContain('toValueState');
  });
});
