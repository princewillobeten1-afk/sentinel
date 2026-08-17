/**
 * TOTP-based MFA (Sprint 30 — Tier 2), RFC 6238, implemented with Node's
 * built-in `crypto` (HMAC-SHA1) — no new dependency, matching this
 * codebase's existing hand-rolled-HMAC-JWT / HMAC-webhook-signing style.
 *
 * Pure functions only — no I/O, no `server-only` — so this stays directly
 * unit-testable under plain Vitest. Storage (`lib/server/mfa-store.ts`) is
 * the separate, I/O-holding half.
 */

import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP_SECONDS = 30;
const DEFAULT_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');

  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid base32 character: ${char}`);
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** A fresh random TOTP secret, base32-encoded (the form authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** `otpauth://` URI an authenticator app can turn into a QR code. */
export function buildOtpauthUri(secretBase32: string, accountLabel: string, issuer = 'Sentinel'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DEFAULT_DIGITS),
    period: String(DEFAULT_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secretBase32: string, counter: number, digits: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 10 ** digits).toString().padStart(digits, '0');
  return code;
}

/** The current (or given-time) 6-digit TOTP code for a secret. */
export function generateTotp(
  secretBase32: string,
  unixSeconds: number = Math.floor(Date.now() / 1000),
  opts: { stepSeconds?: number; digits?: number } = {},
): string {
  const stepSeconds = opts.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = opts.digits ?? DEFAULT_DIGITS;
  const counter = Math.floor(unixSeconds / stepSeconds);
  return hotp(secretBase32, counter, digits);
}

/** Verifies a submitted code, tolerating clock drift of `window` steps on either side (default ±1 step = ±30s). */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { window?: number; unixSeconds?: number; stepSeconds?: number; digits?: number } = {},
): boolean {
  const cleanCode = code.trim();
  if (!/^\d+$/.test(cleanCode)) return false;

  const window = opts.window ?? 1;
  const unixSeconds = opts.unixSeconds ?? Math.floor(Date.now() / 1000);
  const stepSeconds = opts.stepSeconds ?? DEFAULT_STEP_SECONDS;
  const digits = opts.digits ?? DEFAULT_DIGITS;

  for (let delta = -window; delta <= window; delta++) {
    const candidate = generateTotp(secretBase32, unixSeconds + delta * stepSeconds, { stepSeconds, digits });
    if (timingSafeEqualStrings(candidate, cleanCode)) return true;
  }
  return false;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Plaintext one-time backup codes, shown once at enrollment — only hashes are ever stored. */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex'));
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
}

/** Checks `code` against a set of backup-code hashes; returns the remaining hash set with the matched one removed (backup codes are single-use). */
export function verifyAndConsumeBackupCode(hashes: string[], code: string): { valid: boolean; remaining: string[] } {
  const target = hashBackupCode(code);
  const index = hashes.findIndex((hash) => timingSafeEqualStrings(hash, target));
  if (index === -1) return { valid: false, remaining: hashes };
  const remaining = [...hashes.slice(0, index), ...hashes.slice(index + 1)];
  return { valid: true, remaining };
}
