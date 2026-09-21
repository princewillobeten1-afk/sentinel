import { describe, it, expect } from 'vitest';
import { sanitizeTokenName, hasInvisibleCharacters } from '../sanitize-name';
import { mapJupiterToken, type JupiterToken } from '../jupiter-feed';

const RLO = '‮';
const ZWSP = '​';

describe('sanitizeTokenName — bidi spoofing', () => {
  it('strips the right-to-left override seen live', () => {
    // The observed token: with the override the browser reverses everything
    // after it, so this displays as "United States Reserve".
    const raw = `${RLO}evreseR setatS detinU`;
    const out = sanitizeTokenName(raw);

    expect(out.value).toBe('evreseR setatS detinU');
    expect(out.value).not.toContain(RLO);
    expect(out.suspicious).toBe(true);
  });

  it('strips zero-width characters used to clone a ticker', () => {
    // `US​DC` renders identically to `USDC` while being a different string,
    // which is the whole point of the substitution.
    const out = sanitizeTokenName(`US${ZWSP}DC`);
    expect(out.value).toBe('USDC');
    expect(out.suspicious).toBe(true);
  });

  it('covers the isolate controls, not just the override', () => {
    for (const ch of ['‪', '‫', '‬', '‭', '⁦', '⁧', '⁨', '⁩']) {
      expect(sanitizeTokenName(`A${ch}B`).suspicious).toBe(true);
      expect(sanitizeTokenName(`A${ch}B`).value).toBe('AB');
    }
  });

  it('leaves an ordinary name untouched and unflagged', () => {
    const out = sanitizeTokenName('Cheeto and Nuts');
    expect(out.value).toBe('Cheeto and Nuts');
    expect(out.suspicious).toBe(false);
  });

  it('keeps legitimate non-ASCII', () => {
    // Emoji and accented characters are normal in token names and must survive.
    const out = sanitizeTokenName('土豆 café 🐕');
    expect(out.value).toBe('土豆 café 🐕');
    expect(out.suspicious).toBe(false);
  });

  it('handles absent input without throwing', () => {
    expect(sanitizeTokenName(undefined).value).toBe('');
    expect(sanitizeTokenName(null).suspicious).toBe(false);
  });

  it('detects without mutating', () => {
    expect(hasInvisibleCharacters(`${RLO}RSU`)).toBe(true);
    expect(hasInvisibleCharacters('RSU')).toBe(false);
    // A global regex carries lastIndex; repeated calls must agree.
    expect(hasInvisibleCharacters(`${RLO}RSU`)).toBe(true);
  });
});

describe('names are sanitised where they enter the system', () => {
  const token = (over: Partial<JupiterToken> = {}): JupiterToken => ({
    id: '7W3zhfDKKfQSJjzs8tqiN8EPyQf8YXP51pTkuGiXpump',
    name: 'Test Token',
    symbol: 'TEST',
    launchpad: 'pump.fun',
    ...over,
  });

  it('cleans the mapped row and flags it', () => {
    // Cleaning at the boundary covers every consumer — cards, search, the
    // command palette — rather than each render site separately.
    const mapped = mapJupiterToken(token({ name: `${RLO}evreseR setatS detinU`, symbol: `${RLO}RSU` }));

    expect(mapped.name).not.toContain(RLO);
    expect(mapped.symbol).not.toContain(RLO);
    expect(mapped.hasDeceptiveName).toBe(true);
  });

  it('does not flag an ordinary token', () => {
    expect(mapJupiterToken(token()).hasDeceptiveName).toBeUndefined();
  });
});
