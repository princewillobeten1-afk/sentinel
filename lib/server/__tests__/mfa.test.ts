import { describe, expect, it } from 'vitest';
import {
  buildOtpauthUri,
  generateBackupCodes,
  generateTotp,
  generateTotpSecret,
  hashBackupCode,
  verifyAndConsumeBackupCode,
  verifyTotp,
} from '../mfa';

// RFC 6238 Appendix B test vectors (SHA1, 8-digit codes, 30s step, T0=0).
// The RFC's raw ASCII secret "12345678901234567890" base32-encodes to this
// value — the standard test-vector secret used across TOTP implementations.
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('generateTotp against RFC 6238 test vectors', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('produces the known 8-digit code at unix time %i', (unixSeconds, expected) => {
    const code = generateTotp(RFC_SECRET_BASE32, unixSeconds, { digits: 8 });
    expect(code).toBe(expected);
  });
});

describe('verifyTotp', () => {
  it('accepts the exact current code', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000;
    const code = generateTotp(secret, now);
    expect(verifyTotp(secret, code, { unixSeconds: now })).toBe(true);
  });

  it('accepts a code from one step in the past (clock drift tolerance)', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000;
    const codeOneStepAgo = generateTotp(secret, now - 30);
    expect(verifyTotp(secret, codeOneStepAgo, { unixSeconds: now })).toBe(true);
  });

  it('rejects a code from two steps in the past (outside the default window)', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000;
    const codeTwoStepsAgo = generateTotp(secret, now - 60);
    expect(verifyTotp(secret, codeTwoStepsAgo, { unixSeconds: now })).toBe(false);
  });

  it('rejects a code generated from a different secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const now = 1_700_000_000;
    const code = generateTotp(secretA, now);
    expect(verifyTotp(secretB, code, { unixSeconds: now })).toBe(false);
  });

  it('rejects non-numeric input without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'not-a-code')).toBe(false);
  });
});

describe('buildOtpauthUri', () => {
  it('produces a well-formed otpauth URI carrying the secret', () => {
    const secret = generateTotpSecret();
    const uri = buildOtpauthUri(secret, 'trader@sentinel.local');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=Sentinel');
  });
});

describe('backup codes', () => {
  it('generates the requested count of unique codes', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('consumes a valid code exactly once', () => {
    const codes = generateBackupCodes(3);
    const hashes = codes.map(hashBackupCode);

    const first = verifyAndConsumeBackupCode(hashes, codes[0]);
    expect(first.valid).toBe(true);
    expect(first.remaining).toHaveLength(2);

    // The same code must not verify again against the already-reduced hash set.
    const second = verifyAndConsumeBackupCode(first.remaining, codes[0]);
    expect(second.valid).toBe(false);
    expect(second.remaining).toHaveLength(2);
  });

  it('rejects a code that was never issued', () => {
    const codes = generateBackupCodes(3);
    const hashes = codes.map(hashBackupCode);
    const result = verifyAndConsumeBackupCode(hashes, 'deadbeef00');
    expect(result.valid).toBe(false);
    expect(result.remaining).toHaveLength(3);
  });
});
