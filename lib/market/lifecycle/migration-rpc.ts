import 'server-only';

import { quickNodeService } from '@/lib/server/quicknode';
import { resolveMigration, type ResolvedMigration } from './migration-detector';

export interface ConfirmedSignature {
  signature?: string;
  err?: unknown;
  blockTime?: number | null;
}

/** Provider failover retains the decoder's confirmed transaction proof rules. */
export async function fetchMigrationWithFailover(rpcUrl: string, signature: string): Promise<ResolvedMigration | null> {
  const transaction = await quickNodeService.rpcResult<Parameters<typeof resolveMigration>[0]>(
    rpcUrl, 'getTransaction', [
      signature,
      { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ], 10_000,
  );
  return resolveMigration(transaction, signature);
}

export async function fetchConfirmedSignatures(
  rpcUrl: string,
  address: string,
  limit: number,
): Promise<ConfirmedSignature[] | null> {
  const result = await quickNodeService.rpcResult<unknown>(
    rpcUrl, 'getSignaturesForAddress', [address, { limit, commitment: 'confirmed' }],
  );
  return Array.isArray(result) ? result as ConfirmedSignature[] : null;
}
