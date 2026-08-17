import { describe, it, expect } from 'vitest';
import {
  assertScopeGrantable,
  hasRequiredScopes,
  missingScopes,
  isScope,
  DANGEROUS_SCOPES,
  READ_ONLY_SCOPES,
  ScopeGrantError,
} from '../scopes';

describe('scopes', () => {
  it('accepts a valid read-only scope set', () => {
    expect(() => assertScopeGrantable(['READ_MARKET_DATA', 'READ_TOKEN_INTELLIGENCE'])).not.toThrow();
  });

  it('rejects an unknown scope', () => {
    // @ts-expect-error deliberately invalid input
    expect(() => assertScopeGrantable(['NOT_A_REAL_SCOPE'])).toThrow(ScopeGrantError);
  });

  it('requires CREATE_LAUNCH whenever MANAGE_LAUNCH is requested (spec §96)', () => {
    expect(() => assertScopeGrantable(['MANAGE_LAUNCH'])).toThrow(/CREATE_LAUNCH/);
    expect(() => assertScopeGrantable(['CREATE_LAUNCH', 'MANAGE_LAUNCH'])).not.toThrow();
  });

  it('never treats a dangerous scope as part of the read-only set', () => {
    for (const scope of DANGEROUS_SCOPES) {
      expect(READ_ONLY_SCOPES).not.toContain(scope);
    }
  });

  it('hasRequiredScopes passes trivially for an empty requirement', () => {
    expect(hasRequiredScopes([], [])).toBe(true);
  });

  it('hasRequiredScopes fails when any required scope is missing', () => {
    expect(hasRequiredScopes(['READ_MARKET_DATA'], ['READ_MARKET_DATA', 'TRADE'])).toBe(false);
    expect(hasRequiredScopes(['READ_MARKET_DATA', 'TRADE'], ['READ_MARKET_DATA', 'TRADE'])).toBe(true);
  });

  it('missingScopes reports exactly the gap', () => {
    expect(missingScopes(['READ_MARKET_DATA'], ['READ_MARKET_DATA', 'TRADE', 'CREATE_ORDER'])).toEqual([
      'TRADE',
      'CREATE_ORDER',
    ]);
  });

  it('isScope narrows correctly', () => {
    expect(isScope('TRADE')).toBe(true);
    expect(isScope('not-a-scope')).toBe(false);
  });
});
