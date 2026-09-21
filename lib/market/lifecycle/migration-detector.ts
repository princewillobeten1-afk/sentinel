/**
 * Detects lifecycle events in pump.fun program logs.
 *
 * ## Why logs, and why not a percentage
 *
 * A curve reaching 100% is not a migration. The migration is a distinct
 * instruction the program executes afterwards: it can lag, fail, or be retried,
 * and the destination pool only exists once it succeeds. Treating completion as
 * migration would move tokens into the Migrated column before they had moved,
 * with no pool to point at.
 *
 * `logsSubscribe` on the pump.fun program already runs for trade capture, so
 * these events arrive on a transport that is open regardless — no extra polling
 * and no extra RPC budget to notice a launch or a migration.
 *
 * Resolving the *destination pool* does cost one `getTransaction`, but only on
 * an actual migration, which is a handful of events an hour rather than per
 * trade.
 */

import { PUMPFUN_PROGRAM_ID } from './bonding-curve';

/** The same narrow authority watch is used for live events and restart recovery. */
export const PUMPFUN_MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';

export type LifecycleLogEvent =
  | { kind: 'PAIR_CREATED'; signature: string }
  | { kind: 'MIGRATION'; signature: string };

/** pump.fun's own AMM, where completed curves now migrate. */
export const PUMPSWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const RAYDIUM_AMM_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const RAYDIUM_CPMM_PROGRAM_ID = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
export const METEORA_DAMM_PROGRAM_ID = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';
export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

/**
 * Mints that form the *other* side of a migrated pool.
 *
 * A migration creates a TOKEN/SOL pair, so the quote mint is always present in
 * the transaction's token balances alongside the token that actually migrated.
 * These are never the subject of a migration and must never be recorded as one.
 */
export const QUOTE_MINTS: ReadonlySet<string> = new Set([
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

/**
 * Instruction names that mean a new pair exists.
 *
 * Matched on the human-readable "Program log: Instruction: X" line that Anchor
 * programs emit — the same mechanism `helius-log-matchers.ts` already relies on
 * to classify swaps.
 */
const CREATE_INSTRUCTIONS = ['create', 'createv2'];

/**
 * Instruction names that mean the curve's liquidity moved to an AMM.
 *
 * `migrate` is the current path to PumpSwap; `withdraw` was the older one that
 * seeded a Raydium pool. Both are listed because mainnet carries tokens from
 * both eras.
 */
const MIGRATION_INSTRUCTIONS = ['migrate', 'migratev2', 'withdraw'];

function mentionsPumpInstruction(logs: string[], names: string[]): boolean {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const invoke = `program ${PUMPFUN_PROGRAM_ID.toLowerCase()} invoke`;
  for (let index = 0; index < logs.length; index += 1) {
    if (!logs[index]?.toLowerCase().startsWith(invoke)) continue;
    // Anchor writes its instruction name immediately after the program invoke.
    // Stop if another program is invoked first so an unrelated CPI's
    // `Withdraw` can never be attributed to pump.fun.
    for (let cursor = index + 1; cursor < Math.min(logs.length, index + 8); cursor += 1) {
      const line = logs[cursor]?.toLowerCase() ?? '';
      const instruction = line.match(/^program log: instruction: ([a-z0-9_]+)/)?.[1];
      if (instruction) {
        if (wanted.has(instruction)) return true;
        break;
      }
      if (/^program [a-z0-9]+ (invoke|success|failed)/.test(line)) break;
    }
  }
  return false;
}

/**
 * Classifies one pump.fun log notification.
 *
 * Migration is checked first: a transaction that both creates and migrates is
 * the migration, and mislabelling it would register a brand-new pair for a
 * token that just left the curve.
 */
export function classifyLifecycleLogs(signature: string, logs: string[]): LifecycleLogEvent | null {
  if (mentionsPumpInstruction(logs, MIGRATION_INSTRUCTIONS)) {
    return { kind: 'MIGRATION', signature };
  }
  if (mentionsPumpInstruction(logs, CREATE_INSTRUCTIONS)) {
    return { kind: 'PAIR_CREATED', signature };
  }
  return null;
}

export interface ResolvedMigration {
  mint: string;
  poolAddress: string;
  dex: string;
  migratedAt: number;
  signature: string;
}

interface ParsedTransaction {
  blockTime?: number | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{ pubkey?: string } | string>;
      instructions?: Array<{ programId?: string; accounts?: string[]; data?: string }>;
    };
  };
  meta?: {
    err?: unknown;
    postTokenBalances?: Array<{ mint?: string; owner?: string }>;
    innerInstructions?: Array<{ instructions?: Array<{ programId?: string; accounts?: string[]; data?: string }> }>;
  };
}

/**
 * Pulls the migrated mint and its destination pool out of a parsed transaction.
 *
 * Returns null when either cannot be identified. A migration recorded without a
 * pool address is not a migration anyone can act on, and guessing the pool would
 * put a wrong address on a row users click through to.
 */
export function resolveMigration(
  parsed: ParsedTransaction | null,
  signature: string,
): ResolvedMigration | null {
  if (!parsed || parsed.meta?.err !== null || !signature
    || typeof parsed.blockTime !== 'number' || !Number.isFinite(parsed.blockTime) || parsed.blockTime <= 0) return null;

  const instructions = [
    ...(parsed.transaction?.message?.instructions ?? []),
    ...(parsed.meta?.innerInstructions ?? []).flatMap((i) => i.instructions ?? []),
  ];

  // Official pump-public-docs/idl/pump.json, checked 2026-09-12. Both
  // instructions have no arguments: these are their complete base58 data.
  // Decode the mint/pool by the instruction's account contract, never by
  // guessing from balance order or a normal AMM swap in the same transaction.
  const migrations = instructions.filter((ix) => ix.programId === PUMPFUN_PROGRAM_ID
    && (ix.data === 'T5bZvAk4s5f' || ix.data === 'YQq8B6nbicx'));
  if (migrations.length !== 1) return null; // Ambiguous multi-mint transaction.
  const migration = migrations[0];
  const v2 = migration.data === 'YQq8B6nbicx';
  const accounts = migration.accounts;
  if (!accounts || accounts.length < (v2 ? 27 : 25)) return null;
  const mint = accounts[2];
  const poolAddress = accounts[v2 ? 10 : 9];
  if (accounts[v2 ? 9 : 8] !== PUMPSWAP_PROGRAM_ID
    || !mint || QUOTE_MINTS.has(mint) || !poolAddress || poolAddress === mint || QUOTE_MINTS.has(poolAddress)
    || !parsed.meta?.postTokenBalances?.some((balance) => balance.mint === mint)) return null;
  // A successful migration must actually invoke the AMM with this pool.
  if (!instructions.some((ix) => ix.programId === PUMPSWAP_PROGRAM_ID && ix.accounts?.includes(poolAddress))) return null;

  return {
    mint,
    poolAddress,
    dex: 'PumpSwap',
    // Solana reports block time in seconds.
    migratedAt: parsed.blockTime * 1000,
    signature,
  };
}

/** Fetches and resolves a migration transaction. */
export async function fetchMigration(
  rpcUrl: string,
  signature: string,
  timeoutMs = 10_000,
): Promise<ResolvedMigration | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: ParsedTransaction };
    return resolveMigration(body.result ?? null, signature);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
