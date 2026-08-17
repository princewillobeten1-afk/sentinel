import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { DbWalletTransaction } from '@/lib/server/store';

interface WalletTransactionRow {
  id: string;
  user_id: string;
  wallet_id: string;
  direction: DbWalletTransaction['direction'];
  asset: DbWalletTransaction['asset'];
  amount: string;
  destination_address: string;
  signature: string;
  network: string;
  fee_lamports: string | null;
  created_at: string;
}

function rowToTransaction(row: WalletTransactionRow): DbWalletTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    direction: row.direction,
    asset: row.asset,
    amount: Number(row.amount),
    destinationAddress: row.destination_address,
    signature: row.signature,
    network: row.network,
    feeLamports: row.fee_lamports !== null ? Number(row.fee_lamports) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Postgres-backed replacement for `ServerStore`'s wallet-transaction Map, using `wallet_transactions` (db/migrations/021_wallet_transactions.sql). */
export class PgWalletTransactionRepository {
  async recordWalletTransaction(
    userId: string,
    data: Omit<DbWalletTransaction, 'id' | 'userId' | 'createdAt'>,
  ): Promise<DbWalletTransaction> {
    const id = generateId('wtx');
    const { rows } = await dbPool.query<WalletTransactionRow>(
      `INSERT INTO wallet_transactions (id, user_id, wallet_id, direction, asset, amount, destination_address, signature, network, fee_lamports)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        userId,
        data.walletId,
        data.direction,
        data.asset,
        data.amount,
        data.destinationAddress,
        data.signature,
        data.network,
        data.feeLamports ?? null,
      ],
    );
    return rowToTransaction(rows[0] as WalletTransactionRow);
  }

  async getWalletTransactions(userId: string, walletId?: string): Promise<DbWalletTransaction[]> {
    const { rows } = await dbPool.query<WalletTransactionRow>(
      walletId
        ? 'SELECT * FROM wallet_transactions WHERE user_id = $1 AND wallet_id = $2 ORDER BY created_at DESC'
        : 'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      walletId ? [userId, walletId] : [userId],
    );
    return rows.map(rowToTransaction);
  }

  async hasSentToAddress(userId: string, destinationAddress: string): Promise<boolean> {
    const { rows } = await dbPool.query(
      'SELECT 1 FROM wallet_transactions WHERE user_id = $1 AND destination_address = $2 LIMIT 1',
      [userId, destinationAddress],
    );
    return rows.length > 0;
  }
}

export const pgWalletTransactionRepository = new PgWalletTransactionRepository();
