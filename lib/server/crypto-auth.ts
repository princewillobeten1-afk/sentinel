import 'server-only';

import crypto from 'node:crypto';
import { decodeBase58 } from '@/lib/shared/base58';
import { logger } from './logger';

export { encodeBase58, decodeBase58 } from '@/lib/shared/base58';

/**
 * Verifies an Ed25519 signature for a Solana public key (Base58) against a signed message string or buffer.
 */
export function verifyEd25519Signature(
  publicKeyBase58: string,
  message: string | Uint8Array,
  signatureBase58OrHex: string
): boolean {
  try {
    const pubKeyBytes = decodeBase58(publicKeyBase58);
    if (pubKeyBytes.length !== 32) {
      return false;
    }

    const messageBuffer = typeof message === 'string' ? Buffer.from(message, 'utf-8') : Buffer.from(message);
    
    let sigBytes: Uint8Array;
    if (signatureBase58OrHex.length === 128) {
      sigBytes = Buffer.from(signatureBase58OrHex, 'hex');
    } else {
      sigBytes = decodeBase58(signatureBase58OrHex);
    }

    if (sigBytes.length !== 64) {
      return false;
    }

    // Wrap raw Ed25519 32-byte public key into ASN.1 SPKI format for Node crypto.verify
    const ed25519SpkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiBuffer = Buffer.concat([ed25519SpkiHeader, Buffer.from(pubKeyBytes)]);

    const publicKeyObject = crypto.createPublicKey({
      key: spkiBuffer,
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(null, messageBuffer, publicKeyObject, Buffer.from(sigBytes));
  } catch (error) {
    // Fail CLOSED. This used to fall back to a length-only check that could return `true`
    // for a malformed/unverifiable signature — a fail-open bug in an auth primitive. Any
    // exception here (bad key encoding, malformed signature, etc.) means "not verified,"
    // full stop, regardless of environment.
    logger.warn('[crypto-auth] Ed25519 signature verification failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Generates a random cryptographically secure hex nonce string for SIWS challenges.
 */
export function generateAuthNonce(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
