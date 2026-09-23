import { describe, expect, it } from 'vitest';
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { validateSignedSwap } from '../signed-swap';

function pair() {
  const payer = Keypair.generate();
  const recipient = Keypair.generate();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: recipient.publicKey, lamports: 1000 })],
  }).compileToV0Message();
  const unsigned = new VersionedTransaction(message);
  const signed = new VersionedTransaction(message);
  signed.sign([payer]);
  return { payer, unsigned: Buffer.from(unsigned.serialize()).toString('base64'), signed };
}

describe('wallet signed swap validation', () => {
  it('accepts a valid signature over exactly the prepared message', () => {
    const { payer, unsigned, signed } = pair();
    expect(validateSignedSwap(Buffer.from(signed.serialize()).toString('base64'), unsigned, payer.publicKey.toBase58())).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
  });

  it('rejects altered instructions even when the wallet signs them', () => {
    const { payer, unsigned } = pair();
    const changed = new VersionedTransaction(new TransactionMessage({
      payerKey: payer.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58(),
      instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 9999 })],
    }).compileToV0Message());
    changed.sign([payer]);
    expect(() => validateSignedSwap(Buffer.from(changed.serialize()).toString('base64'), unsigned, payer.publicKey.toBase58())).toThrow(/differs from the reviewed swap/);
  });

  it('rejects an unsigned payload and a different fee payer', () => {
    const { payer, unsigned } = pair();
    expect(() => validateSignedSwap(unsigned, unsigned, payer.publicKey.toBase58())).toThrow(/valid wallet signature/);
    expect(() => validateSignedSwap(unsigned, unsigned, Keypair.generate().publicKey.toBase58())).toThrow(/signer does not match/);
  });
});
