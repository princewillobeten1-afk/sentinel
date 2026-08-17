import 'server-only';

import type { PoolClient } from 'pg';
import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { DbWallet } from '@/lib/server/store';

interface WalletRow {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  label: string;
  is_primary: boolean;
  balance_sol: string;
  status: DbWallet['status'];
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

function rowToWallet(row: WalletRow): DbWallet {
  return {
    id: row.id,
    userId: row.user_id,
    address: row.address,
    network: row.chain,
    label: row.label,
    isPrimary: row.is_primary,
    balanceSol: Number(row.balance_sol),
    status: row.status,
    firstSeenAt: new Date(row.first_seen_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Postgres-backed replacement for `ServerStore`'s wallet Map. Method names
 * and return shapes mirror `ServerStore` exactly (Phase 1's interface-freeze
 * contract).
 */
export class PgWalletRepository {
  async findWalletByAddress(address: string): Promise<DbWallet | undefined> {
    const { rows } = await dbPool.query<WalletRow>(
      'SELECT * FROM wallets WHERE LOWER(address) = LOWER($1) LIMIT 1',
      [address],
    );
    return rows[0] ? rowToWallet(rows[0]) : undefined;
  }

  async getUserWallets(userId: string): Promise<DbWallet[]> {
    const { rows } = await dbPool.query<WalletRow>(
      'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return rows.map(rowToWallet);
  }

  /**
   * `SELECT ... FOR UPDATE` inside a transaction, not a plain read-then-write —
   * closes the TOCTOU race the in-memory `Map` version has today (two
   * concurrent requests linking the same address could both pass the
   * ownership check before either writes).
   */
  async addWalletToUser(userId: string, address: string, label = 'Secondary Wallet'): Promise<DbWallet> {
    return dbPool.withTransaction(async (client) => {
      const { rows: existingRows } = await client.query<WalletRow>(
        'SELECT * FROM wallets WHERE LOWER(address) = LOWER($1) LIMIT 1 FOR UPDATE',
        [address],
      );
      const existing = existingRows[0];
      if (existing) {
        if (existing.user_id !== userId) {
          throw new Error('Wallet address is already linked to another Sentinel account.');
        }
        return rowToWallet(existing);
      }

      const { rows: countRows } = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM wallets WHERE user_id = $1',
        [userId],
      );
      const isPrimary = Number(countRows[0]?.count ?? 0) === 0;
      const balanceSol = Math.round((Math.random() * 15 + 1) * 100) / 100;
      const walletId = generateId('w');

      const { rows } = await client.query<WalletRow>(
        `INSERT INTO wallets (id, user_id, chain, address, label, is_primary, balance_sol, status, first_seen_at, last_seen_at)
         VALUES ($1, $2, 'solana', $3, $4, $5, $6, 'active', NOW(), NOW())
         RETURNING *`,
        [walletId, userId, address, label, isPrimary, balanceSol],
      );
      return rowToWallet(rows[0] as WalletRow);
    });
  }

  async updateWallet(walletId: string, userId: string, updates: { label?: string; isPrimary?: boolean }): Promise<DbWallet> {
    return dbPool.withTransaction(async (client) => {
      const wallet = await this.assertOwnedWallet(client, walletId, userId);

      if (updates.isPrimary) {
        await client.query('UPDATE wallets SET is_primary = FALSE WHERE user_id = $1', [userId]);
      }

      const { rows } = await client.query<WalletRow>(
        `UPDATE wallets
         SET label = COALESCE($3, label),
             is_primary = COALESCE($4, is_primary),
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [walletId, userId, updates.label ?? null, updates.isPrimary ?? null],
      );
      if (!rows[0]) throw new Error('Wallet not found or access denied.');
      void wallet;
      return rowToWallet(rows[0]);
    });
  }

  async unlinkWallet(walletId: string, userId: string): Promise<void> {
    await dbPool.withTransaction(async (client) => {
      const wallet = await this.assertOwnedWallet(client, walletId, userId);

      const { rows: countRows } = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM wallets WHERE user_id = $1',
        [userId],
      );
      if (Number(countRows[0]?.count ?? 0) <= 1) {
        throw new Error('Cannot unlink the sole remaining wallet on account.');
      }

      await client.query('DELETE FROM wallets WHERE id = $1', [walletId]);

      if (wallet.isPrimary) {
        await client.query(
          `UPDATE wallets SET is_primary = TRUE
           WHERE id = (SELECT id FROM wallets WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1)`,
          [userId],
        );
      }
    });
  }

  private async assertOwnedWallet(client: PoolClient, walletId: string, userId: string): Promise<DbWallet> {
    const { rows } = await client.query<WalletRow>('SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [walletId]);
    const wallet = rows[0];
    if (!wallet || wallet.user_id !== userId) {
      throw new Error('Wallet not found or access denied.');
    }
    return rowToWallet(wallet);
  }
}

export const pgWalletRepository = new PgWalletRepository();
