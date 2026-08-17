import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { DbUser, DbWallet, DbUserPreferences } from '@/lib/server/store';

interface UserRow {
  id: string;
  email: string | null;
  display_name: string;
  role: DbUser['role'];
  status: DbUser['status'];
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): DbUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Postgres-backed replacement for `ServerStore`'s user Map. Method names and
 * return shapes mirror `ServerStore` exactly (Phase 1's interface-freeze
 * contract) — see `lib/server/store.ts`'s facade for how this is wired in.
 */
export class PgUserRepository {
  async findUserById(userId: string): Promise<DbUser | undefined> {
    const { rows } = await dbPool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async listUsers(): Promise<DbUser[]> {
    const { rows } = await dbPool.query<UserRow>('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(rowToUser);
  }

  async updateUserRole(userId: string, role: DbUser['role']): Promise<DbUser> {
    const { rows } = await dbPool.query<UserRow>(
      `UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [userId, role],
    );
    if (!rows[0]) throw new Error('User not found.');
    return rowToUser(rows[0]);
  }

  async updateUserStatus(userId: string, status: DbUser['status']): Promise<DbUser> {
    const { rows } = await dbPool.query<UserRow>(
      `UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [userId, status],
    );
    if (!rows[0]) throw new Error('User not found.');
    return rowToUser(rows[0]);
  }

  /**
   * Creates a user + primary wallet + default preferences atomically — an
   * upgrade over the in-memory version's three separate, non-atomic writes.
   */
  async createUserWithWallet(address: string, label = 'Solana Wallet'): Promise<{ user: DbUser; wallet: DbWallet }> {
    return dbPool.withTransaction(async (client) => {
      const userId = generateId('usr');
      const walletId = generateId('w');
      const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

      const { rows: userRows } = await client.query<UserRow>(
        `INSERT INTO users (id, display_name, role, status)
         VALUES ($1, $2, 'user', 'active')
         RETURNING *`,
        [userId, `Sentinel User (${shortAddress})`],
      );

      const { rows: walletRows } = await client.query(
        `INSERT INTO wallets (id, user_id, chain, address, label, is_primary, balance_sol, status, first_seen_at, last_seen_at)
         VALUES ($1, $2, 'solana', $3, $4, TRUE, 24.5, 'active', NOW(), NOW())
         RETURNING *`,
        [walletId, userId, address, label],
      );

      const defaultPreferences: Omit<DbUserPreferences, 'userId'> = {
        slippageTolerance: 0.5,
        riskLevel: 'moderate',
        currencyDisplay: 'USD',
        rpcEndpoint: 'mainnet',
        theme: 'dark',
        density: 'standard',
        autoLockMinutes: 30,
        notificationsEnabled: { security: true, priceAlerts: true, tradeExecution: true, system: true },
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        `INSERT INTO user_settings (user_id, sentinel_preferences)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, JSON.stringify(defaultPreferences)],
      );

      const user = rowToUser(userRows[0] as UserRow);
      const walletRow = walletRows[0] as Record<string, unknown>;
      const wallet: DbWallet = {
        id: walletRow.id as string,
        userId: walletRow.user_id as string,
        address: walletRow.address as string,
        network: walletRow.chain as string,
        label: walletRow.label as string,
        isPrimary: walletRow.is_primary as boolean,
        balanceSol: Number(walletRow.balance_sol),
        status: walletRow.status as DbWallet['status'],
        firstSeenAt: new Date(walletRow.first_seen_at as string).toISOString(),
        lastSeenAt: new Date(walletRow.last_seen_at as string).toISOString(),
        createdAt: new Date(walletRow.created_at as string).toISOString(),
        updatedAt: new Date(walletRow.updated_at as string).toISOString(),
      };

      return { user, wallet };
    });
  }
}

export const pgUserRepository = new PgUserRepository();
