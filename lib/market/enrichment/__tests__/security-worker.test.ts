import { describe, expect, it } from 'vitest';
import { PublicKey, type AccountInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { parseMintAuthorities } from '../security-worker';

const MINT = 'So11111111111111111111111111111111111111112';
const info = (size = 82, owner = TOKEN_PROGRAM_ID): AccountInfo<Buffer> => {
  const data = Buffer.alloc(size);
  data[45] = 1;
  return { owner, data, executable: false, lamports: 1, rentEpoch: 0 };
};

describe('mint authority evidence', () => {
  it('reads revoked authorities from initialized legacy and Token-2022 mints', () => {
    for (const owner of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      expect(parseMintAuthorities(MINT, info(82, owner))).toEqual({ mintRevoked: true, freezeRevoked: true });
    }
  });
  it('reads active authorities without claiming revocation', () => {
    const mint = info();
    mint.data.writeUInt32LE(1, 0);
    mint.data.writeUInt32LE(1, 46);
    expect(parseMintAuthorities(MINT, mint)).toEqual({ mintRevoked: false, freezeRevoked: false });
  });
  it('rejects token accounts, wrong owners, truncated and uninitialized accounts', () => {
    const uninitialized = info();
    uninitialized.data[45] = 0;
    for (const account of [null, info(50), info(165), info(82, new PublicKey(MINT)), uninitialized]) {
      expect(parseMintAuthorities(MINT, account)).toEqual({});
    }
  });
});
