import 'server-only';
import { createPublicKey, verify } from 'node:crypto';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { ApiError } from '@/lib/server/errors';

export function decodeSwap(base64: string): VersionedTransaction {
  try {
    if (!base64 || base64.length > 1644 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error();
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > 1232 || bytes.toString('base64') !== base64) throw new Error();
    return VersionedTransaction.deserialize(bytes);
  } catch { throw new ApiError('Invalid serialized Solana transaction.', 400, 'INVALID_SIGNED_TRANSACTION'); }
}
export function validatePreparedSwap(unsignedBase64: string, wallet: string) {
  const tx = decodeSwap(unsignedBase64);
  if (tx.message.header.numRequiredSignatures !== 1 || tx.message.staticAccountKeys[0].toBase58() !== wallet)
    throw new ApiError('Prepared swap signer does not match the connected wallet.', 400, 'SIGNER_MISMATCH');
  return tx;
}
export function validateSignedSwap(signedBase64: string, unsignedBase64: string, wallet: string): string {
  const unsigned = validatePreparedSwap(unsignedBase64, wallet);
  const signed = validatePreparedSwap(signedBase64, wallet);
  const message = Buffer.from(signed.message.serialize());
  if (!message.equals(Buffer.from(unsigned.message.serialize())))
    throw new ApiError('The signed transaction differs from the reviewed swap. Nothing was broadcast.', 400, 'TRANSACTION_TAMPERED');
  const signature = signed.signatures[0];
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(signed.message.staticAccountKeys[0].toBytes())]), format: 'der', type: 'spki' });
  if (!signature || !verify(null, message, key, signature))
    throw new ApiError('A valid wallet signature is required. Nothing was broadcast.', 400, 'INVALID_SIGNATURE');
  return bs58.encode(signature);
}
