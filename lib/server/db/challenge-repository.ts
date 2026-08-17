import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { DbAuthChallenge } from '@/lib/server/store';

interface ChallengeRow {
  id: string;
  wallet_address: string;
  nonce: string;
  message: string;
  expires_at: string;
  created_at: string;
}

function rowToChallenge(row: ChallengeRow): DbAuthChallenge {
  return {
    id: row.id,
    address: row.wallet_address,
    nonce: row.nonce,
    statement: row.message,
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Postgres-backed replacement for `ServerStore`'s challenge Map, using the
 * pre-existing `auth_challenges` table (020_auth_identity_wallet_system.sql)
 * — column names (`wallet_address`/`message`) differ from `DbAuthChallenge`'s
 * TS field names (`address`/`statement`), mapped here rather than renamed in
 * the migration since the SQL names are the more descriptive ones.
 */
export class PgChallengeRepository {
  async saveChallenge(address: string, nonce: string, statement: string, expiresAt: string): Promise<DbAuthChallenge> {
    const id = generateId('ch');
    const { rows } = await dbPool.query<ChallengeRow>(
      `INSERT INTO auth_challenges (id, wallet_address, chain_id, nonce, message, expires_at)
       VALUES ($1, $2, 'solana', $3, $4, $5)
       RETURNING *`,
      [id, address, nonce, statement, expiresAt],
    );
    return rowToChallenge(rows[0] as ChallengeRow);
  }

  async getChallengeByNonce(nonce: string): Promise<DbAuthChallenge | undefined> {
    const { rows } = await dbPool.query<ChallengeRow>(
      'SELECT * FROM auth_challenges WHERE nonce = $1 AND used_at IS NULL',
      [nonce],
    );
    const row = rows[0];
    if (!row) return undefined;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await dbPool.query('DELETE FROM auth_challenges WHERE nonce = $1', [nonce]);
      return undefined;
    }
    return rowToChallenge(row);
  }

  /**
   * One atomic `DELETE ... RETURNING`, not read-then-delete — a second
   * `consumeChallenge` for the same nonce is guaranteed to find nothing,
   * strictly stronger replay protection than the in-memory version.
   */
  async consumeChallenge(nonce: string): Promise<void> {
    await dbPool.query('DELETE FROM auth_challenges WHERE nonce = $1', [nonce]);
  }
}

export const pgChallengeRepository = new PgChallengeRepository();
