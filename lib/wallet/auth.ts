import { encodeBase58 } from '@/lib/shared/base58';

export interface SIWSMessage {
  domain: string;
  address: string;
  purpose: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return encodeBase58(array);
  }
  // Fallback for node environments without global crypto
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function createSIWSMessage(address: string, domain: string, purpose: string): SIWSMessage {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const nonce = generateNonce();

  return {
    domain,
    address,
    purpose,
    nonce,
    issuedAt,
    expiresAt,
  };
}

export function formatSIWSMessage(message: SIWSMessage): string {
  return `${message.domain} wants you to sign in with your Solana account:
${message.address}

${message.purpose}

Nonce: ${message.nonce}
Issued At: ${message.issuedAt}
Expiration Time: ${message.expiresAt}`;
}
