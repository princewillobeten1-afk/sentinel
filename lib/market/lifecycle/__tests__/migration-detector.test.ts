import { describe, it, expect } from 'vitest';
import { PUMPFUN_PROGRAM_ID } from '../bonding-curve';
import {
  PUMPSWAP_PROGRAM_ID,
  QUOTE_MINTS,
  classifyLifecycleLogs,
  resolveMigration,
} from '../migration-detector';

const WSOL = 'So11111111111111111111111111111111111111112';
const TOKEN = 'CybSRsmzi8A9yDEd5zBQkbYzJhxyBJfRDLGZeR7ypump';
const POOL = '69adh3DJAAZWmhMN8HdBvyu29oxkri5gxiMUn5P5FNmZ';
const SIG = '4SkaFoxqszk8tWCRjrieR5KXRzLKzRJeQ6PnCAVvWrZ';
const migrateAccounts = (v2 = false) => {
  const accounts = Array.from({ length: v2 ? 27 : 25 }, (_, index) => `Account${index}`);
  accounts[2] = TOKEN;
  accounts[v2 ? 9 : 8] = PUMPSWAP_PROGRAM_ID;
  accounts[v2 ? 10 : 9] = POOL;
  return accounts;
};

/** A migration transaction that seeds a TOKEN/SOL pool. */
const tx = (over: Record<string, unknown> = {}) => ({
  blockTime: 1_788_001_190,
  meta: {
    err: null,
    // Wrapped SOL first, which is what the live transaction looked like.
    postTokenBalances: [{ mint: WSOL }, { mint: TOKEN }],
    innerInstructions: [
      { instructions: [{ programId: PUMPSWAP_PROGRAM_ID, accounts: [WSOL, POOL, TOKEN] }] },
    ],
  },
  transaction: { message: { instructions: [
    { programId: PUMPFUN_PROGRAM_ID, data: 'T5bZvAk4s5f', accounts: migrateAccounts() },
  ] } },
  ...over,
});

describe('resolveMigration — the migrated token is never the quote mint', () => {
  it('picks the token, not the wrapped SOL it was paired against', () => {
    // The regression this pins. Taking the first postTokenBalances entry
    // recorded So1111…1112 as a migrated token, and it sat in the Migrated
    // column as though Wrapped SOL had graduated off a bonding curve.
    const resolved = resolveMigration(tx(), SIG);
    expect(resolved?.mint).toBe(TOKEN);
    expect(resolved?.mint).not.toBe(WSOL);
  });

  it("never reports a pool address that is one of the pool's own mints", () => {
    // The same live record had poolAddress === So1111…1112, from taking
    // accounts[0] unconditionally. That address is what a user clicks through.
    const resolved = resolveMigration(tx(), SIG);
    expect(resolved?.poolAddress).toBe(POOL);
    expect(QUOTE_MINTS.has(resolved?.poolAddress ?? '')).toBe(false);
    expect(resolved?.poolAddress).not.toBe(resolved?.mint);
  });

  it('refuses a transaction carrying only quote mints', () => {
    const resolved = resolveMigration(
      tx({ meta: { postTokenBalances: [{ mint: WSOL }], innerInstructions: [] } }),
      SIG,
    );
    expect(resolved).toBeNull();
  });

  it('refuses when no pool can be identified rather than guessing one', () => {
    // Unconfirmed means the token stays in MIGRATING. A migration with no
    // destination is not one anyone can act on.
    const resolved = resolveMigration(
      tx({
        meta: {
          postTokenBalances: [{ mint: WSOL }, { mint: TOKEN }],
          innerInstructions: [
            { instructions: [{ programId: PUMPSWAP_PROGRAM_ID, accounts: [WSOL, TOKEN] }] },
          ],
        },
      }),
      SIG,
    );
    expect(resolved).toBeNull();
  });

  it('refuses a failed transaction', () => {
    expect(resolveMigration(tx({ meta: { ...tx().meta, err: {} } }), SIG)).toBeNull();
  });

  it('does not guess a migration proof from a Raydium CPMM invocation', () => {
    const CPMM = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
    const cpmmTx = tx({
      meta: {
        postTokenBalances: [{ mint: WSOL }, { mint: TOKEN }],
        innerInstructions: [
          { instructions: [{ programId: CPMM, accounts: [WSOL, POOL, TOKEN] }] },
        ],
      },
    });
    const resolved = resolveMigration(cpmmTx, SIG);
    expect(resolved).toBeNull();
  });

  it('does not guess a migration proof from a Meteora invocation', () => {
    const METEORA = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';
    const meteoraTx = tx({
      meta: {
        postTokenBalances: [{ mint: WSOL }, { mint: TOKEN }],
        innerInstructions: [
          { instructions: [{ programId: METEORA, accounts: [WSOL, POOL, TOKEN] }] },
        ],
      },
    });
    const resolved = resolveMigration(meteoraTx, SIG);
    expect(resolved).toBeNull();
  });

  it('refuses an ordinary pool trade, even if it has the right balances and AMM', () => {
    expect(resolveMigration(tx({ transaction: { message: { instructions: [] } } }), SIG)).toBeNull();
  });

  it('does not fabricate a timestamp when confirmed block time is missing', () => {
    expect(resolveMigration(tx({ blockTime: null }), SIG)).toBeNull();
  });

  it('uses the v2 account layout and not unrelated token balance order', () => {
    const fixture = tx({ transaction: { message: { instructions: [
      { programId: PUMPFUN_PROGRAM_ID, data: 'YQq8B6nbicx', accounts: migrateAccounts(true) },
    ] } } });
    fixture.meta.postTokenBalances.unshift({ mint: 'UnrelatedToken' });
    expect(resolveMigration(fixture, SIG)).toMatchObject({ mint: TOKEN, poolAddress: POOL, dex: 'PumpSwap' });
  });

  it('requires the PumpSwap CPI to reference the decoded pool', () => {
    const fixture = tx();
    fixture.meta.innerInstructions[0].instructions[0].accounts = ['DifferentPool'];
    expect(resolveMigration(fixture, SIG)).toBeNull();
  });
});

describe('classifyLifecycleLogs', () => {
  it('checks later pump invocations after an earlier non-migration instruction', () => {
    expect(classifyLifecycleLogs(SIG, [
      `Program ${PUMPFUN_PROGRAM_ID} invoke [1]`,
      'Program log: Instruction: Buy',
      `Program ${PUMPFUN_PROGRAM_ID} success`,
      `Program ${PUMPFUN_PROGRAM_ID} invoke [1]`,
      'Program log: Instruction: MigrateV2',
    ])).toEqual({ kind: 'MIGRATION', signature: SIG });
  });
  it('recognizes a migrate instruction emitted by the pump.fun program', () => {
    expect(classifyLifecycleLogs(SIG, [
      'Program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P invoke [1]',
      'Program log: Instruction: MigrateV2',
    ])).toEqual({ kind: 'MIGRATION', signature: SIG });
  });

  it("does not treat another program's Withdraw CPI as a pump.fun migration", () => {
    expect(classifyLifecycleLogs(SIG, [
      'Program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 invoke [1]',
      'Program log: Instruction: SharedAccountsRouteV2',
      'Program 24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi invoke [2]',
      'Program log: Instruction: Withdraw',
    ])).toBeNull();
  });
});
