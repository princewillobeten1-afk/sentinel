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
import type { Launchpad } from './types';
import { LAUNCHPAD_CONFIGS } from './launchpads';

/** The same narrow authority watch is used for live events and restart recovery. */
export const PUMPFUN_MIGRATION_AUTHORITY = '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg';

/** Launchpad Program IDs */
export const MOONSHOT_PROGRAM_ID = 'CURVEmPpijXDTNdqrA9PGP1io2rkgiVXH26xdXVGLLfz';
export const LAUNCHLAB_PROGRAM_ID = 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj';
export const METEORA_DBC_PROGRAM_ID = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';

export type LifecycleLogEvent =
  | { kind: 'PAIR_CREATED'; signature: string; launchpad?: Launchpad }
  | { kind: 'MIGRATION'; signature: string; launchpad?: Launchpad };

/** Destination AMM programs where completed curves migrate */
export const PUMPSWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const RAYDIUM_AMM_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
export const RAYDIUM_CPMM_PROGRAM_ID = 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C';
export const METEORA_DAMM_PROGRAM_ID = 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB';
export const METEORA_DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';
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

const CREATE_INSTRUCTIONS = ['create', 'createv2', 'initialize', 'initialize_v2'];
const MIGRATION_INSTRUCTIONS = ['migrate', 'migratev2', 'withdraw', 'migrate_to_raydium', 'graduate'];

function mentionsProgramInstruction(logs: string[], programId: string, names: string[]): boolean {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const invoke = `program ${programId.toLowerCase()} invoke`;
  for (let index = 0; index < logs.length; index += 1) {
    if (!logs[index]?.toLowerCase().startsWith(invoke)) continue;
    // Anchor writes its instruction name immediately after the program invoke.
    // Stop if another program is invoked first so an unrelated CPI's
    // instruction can never be attributed to the target program.
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
 * Classifies log notifications across supported launchpads.
 */
export function classifyLifecycleLogs(signature: string, logs: string[]): LifecycleLogEvent | null {
  // 1. Pump.fun
  if (mentionsProgramInstruction(logs, PUMPFUN_PROGRAM_ID, ['migrate', 'migratev2', 'withdraw'])) {
    return { kind: 'MIGRATION', signature };
  }
  if (mentionsProgramInstruction(logs, PUMPFUN_PROGRAM_ID, ['create', 'createv2'])) {
    return { kind: 'PAIR_CREATED', signature };
  }

  // 2. Moonshot
  if (mentionsProgramInstruction(logs, MOONSHOT_PROGRAM_ID, ['migrate_to_raydium', 'migrate'])) {
    return { kind: 'MIGRATION', signature };
  }
  if (mentionsProgramInstruction(logs, MOONSHOT_PROGRAM_ID, ['create', 'initialize'])) {
    return { kind: 'PAIR_CREATED', signature };
  }

  // 3. LaunchLab / LetsBonk
  if (mentionsProgramInstruction(logs, LAUNCHLAB_PROGRAM_ID, ['graduate', 'initialize_cpmm'])) {
    return { kind: 'MIGRATION', signature };
  }
  if (mentionsProgramInstruction(logs, LAUNCHLAB_PROGRAM_ID, ['initialize_v2', 'create'])) {
    return { kind: 'PAIR_CREATED', signature };
  }

  // 4. Believe (Meteora DBC)
  if (mentionsProgramInstruction(logs, METEORA_DBC_PROGRAM_ID, ['initialize_virtual_pool_with_spl_token'])) {
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
  originLaunchpad?: Launchpad;
  lpHandling?: string;
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
 * Pulls the migrated mint, origin launchpad, and destination pool out of a parsed transaction.
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

  // 1. Pump.fun migrations
  const pumpMigrations = instructions.filter((ix) => ix.programId === PUMPFUN_PROGRAM_ID
    && (ix.data === 'T5bZvAk4s5f' || ix.data === 'YQq8B6nbicx'));
  if (pumpMigrations.length === 1) {
    const migration = pumpMigrations[0];
    const v2 = migration.data === 'YQq8B6nbicx';
    const accounts = migration.accounts;
    if (accounts && accounts.length >= (v2 ? 27 : 25)) {
      const mint = accounts[2];
      const poolAddress = accounts[v2 ? 10 : 9];
      if (accounts[v2 ? 9 : 8] === PUMPSWAP_PROGRAM_ID
        && mint && !QUOTE_MINTS.has(mint) && poolAddress && poolAddress !== mint && !QUOTE_MINTS.has(poolAddress)
        && parsed.meta?.postTokenBalances?.some((balance) => balance.mint === mint)
        && instructions.some((ix) => ix.programId === PUMPSWAP_PROGRAM_ID && ix.accounts?.includes(poolAddress))) {
        return {
          mint,
          poolAddress,
          dex: 'PumpSwap',
          originLaunchpad: 'pump.fun',
          lpHandling: LAUNCHPAD_CONFIGS['pump.fun'].lpHandling,
          migratedAt: parsed.blockTime * 1000,
          signature,
        };
      }
    }
  }

  // 2. LaunchLab migrations (invoking Raydium CPMM)
  const launchLabInstructions = instructions.filter((ix) => ix.programId === LAUNCHLAB_PROGRAM_ID);
  const cpmmInvocations = instructions.filter((ix) => ix.programId === RAYDIUM_CPMM_PROGRAM_ID);
  if (launchLabInstructions.length > 0 && cpmmInvocations.length > 0) {
    const nonQuoteTokens = (parsed.meta?.postTokenBalances ?? [])
      .map((b) => b.mint)
      .filter((m): m is string => Boolean(m && !QUOTE_MINTS.has(m)));
    const uniqueTokens = [...new Set(nonQuoteTokens)];
    if (uniqueTokens.length === 1) {
      const mint = uniqueTokens[0];
      for (const cpmmIx of cpmmInvocations) {
        const poolAccount = cpmmIx.accounts?.find(
          (acc) => acc && acc !== mint && !QUOTE_MINTS.has(acc) && acc !== RAYDIUM_CPMM_PROGRAM_ID,
        );
        if (poolAccount) {
          return {
            mint,
            poolAddress: poolAccount,
            dex: 'Raydium CPMM',
            originLaunchpad: 'launchlab',
            lpHandling: LAUNCHPAD_CONFIGS.launchlab.lpHandling,
            migratedAt: parsed.blockTime * 1000,
            signature,
          };
        }
      }
    }
  }

  // 3. Moonshot migrations (invoking Raydium AMM)
  const moonshotInstructions = instructions.filter((ix) => ix.programId === MOONSHOT_PROGRAM_ID);
  const raydiumInvocations = instructions.filter(
    (ix) => ix.programId === RAYDIUM_AMM_V4_PROGRAM_ID || ix.programId === RAYDIUM_CPMM_PROGRAM_ID,
  );
  if (moonshotInstructions.length > 0 && raydiumInvocations.length > 0) {
    const nonQuoteTokens = (parsed.meta?.postTokenBalances ?? [])
      .map((b) => b.mint)
      .filter((m): m is string => Boolean(m && !QUOTE_MINTS.has(m)));
    const uniqueTokens = [...new Set(nonQuoteTokens)];
    if (uniqueTokens.length === 1) {
      const mint = uniqueTokens[0];
      for (const rayIx of raydiumInvocations) {
        const poolAccount = rayIx.accounts?.find(
          (acc) => acc && acc !== mint && !QUOTE_MINTS.has(acc) && acc !== rayIx.programId,
        );
        if (poolAccount) {
          return {
            mint,
            poolAddress: poolAccount,
            dex: 'Raydium',
            originLaunchpad: 'moonshot',
            lpHandling: LAUNCHPAD_CONFIGS.moonshot.lpHandling,
            migratedAt: parsed.blockTime * 1000,
            signature,
          };
        }
      }
    }
  }

  // 4. Believe / Meteora DBC migrations (invoking Meteora DAMM v2)
  const dbcInstructions = instructions.filter((ix) => ix.programId === METEORA_DBC_PROGRAM_ID);
  const dammInvocations = instructions.filter((ix) => ix.programId === METEORA_DAMM_V2_PROGRAM_ID);
  if (dbcInstructions.length > 0 && dammInvocations.length > 0) {
    const nonQuoteTokens = (parsed.meta?.postTokenBalances ?? [])
      .map((b) => b.mint)
      .filter((m): m is string => Boolean(m && !QUOTE_MINTS.has(m)));
    const uniqueTokens = [...new Set(nonQuoteTokens)];
    if (uniqueTokens.length === 1) {
      const mint = uniqueTokens[0];
      for (const dammIx of dammInvocations) {
        const poolAccount = dammIx.accounts?.find(
          (acc) => acc && acc !== mint && !QUOTE_MINTS.has(acc) && acc !== dammIx.programId,
        );
        if (poolAccount) {
          return {
            mint,
            poolAddress: poolAccount,
            dex: 'Meteora DAMM v2',
            originLaunchpad: 'believe',
            lpHandling: LAUNCHPAD_CONFIGS.believe.lpHandling,
            migratedAt: parsed.blockTime * 1000,
            signature,
          };
        }
      }
    }
  }

  return null;
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
