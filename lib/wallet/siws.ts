import { SIWSChallenge } from './types';
import { encodeBase58 } from '@/lib/shared/base58';

/**
 * Builds standard Sign-In With Solana (SIWS) challenge message string.
 */
export function formatSIWSMessage(challenge: SIWSChallenge): string {
  return [
    `${challenge.domain} wants you to sign in with your Solana account:`,
    challenge.address,
    '',
    challenge.statement,
    '',
    `URI: https://${challenge.domain}`,
    `Version: 1`,
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expiresAt}`,
  ].join('\n');
}

/**
 * Converts Uint8Array signature to Base58 string for transmission.
 */
export function signatureToBase58(signature: Uint8Array): string {
  return encodeBase58(signature);
}
