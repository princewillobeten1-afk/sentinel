/**
 * Base58 encode/decode. Pure math, no Node builtins — safe to import from
 * client components (unlike `lib/server/crypto-auth.ts`, which pulls in
 * `node:crypto` and must never reach a browser bundle).
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(buffer: Uint8Array): string {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    str += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += ALPHABET[digits[i]];
  }
  return str;
}

export function decodeBase58(str: string): Uint8Array {
  const MAP: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    MAP[ALPHABET[i]] = i;
  }
  let bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (!(c in MAP)) throw new Error(`Invalid base58 character: ${c}`);
    let carry = MAP[c];
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}
