import 'server-only';
import { dbPool } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';
import type { SwapQuote } from './jupiter-quote';
export interface PreparedSwap {
  id: string; user_id: string; request_key: string; fingerprint: string; wallet: string; network: 'solana:mainnet';
  unsigned_tx: string; last_valid_block_height: number; expires_at: string; quote: SwapQuote; fee_lamports: number | null;
  status: 'prepared' | 'pending' | 'confirmed' | 'failed' | 'expired'; signature: string | null; reason: string | null;
}
function row(value: any): PreparedSwap {
  return { ...value, last_valid_block_height: Number(value.last_valid_block_height),
    fee_lamports: value.fee_lamports == null ? null : Number(value.fee_lamports), expires_at: new Date(value.expires_at).toISOString() };
}
export const swapRepository = {
  async ready() { await dbPool.query('SELECT id FROM prepared_solana_swaps LIMIT 0'); },
  async find(userId: string, id: string): Promise<PreparedSwap | null> {
    const { rows } = await dbPool.query('SELECT * FROM prepared_solana_swaps WHERE user_id=$1 AND id=$2', [userId, id]);
    return rows[0] ? row(rows[0]) : null;
  },
  async byRequest(userId: string, key: string): Promise<PreparedSwap | null> {
    const { rows } = await dbPool.query('SELECT * FROM prepared_solana_swaps WHERE user_id=$1 AND request_key=$2', [userId, key]);
    return rows[0] ? row(rows[0]) : null;
  },
  async create(swap: PreparedSwap): Promise<PreparedSwap> {
    const { rows } = await dbPool.query(`INSERT INTO prepared_solana_swaps
      (id,user_id,request_key,fingerprint,wallet,network,unsigned_tx,last_valid_block_height,expires_at,quote,fee_lamports)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
      ON CONFLICT (user_id,request_key) DO NOTHING RETURNING *`, [swap.id,swap.user_id,swap.request_key,swap.fingerprint,
      swap.wallet,swap.network,swap.unsigned_tx,swap.last_valid_block_height,swap.expires_at,JSON.stringify(swap.quote),swap.fee_lamports]);
    const stored = rows[0] ? row(rows[0]) : await this.byRequest(swap.user_id, swap.request_key);
    if (!stored || stored.fingerprint !== swap.fingerprint) throw new ApiError('This trade request key was already used for different parameters.', 409, 'IDEMPOTENCY_CONFLICT');
    return stored;
  },
  /** Commit the deterministic signature BEFORE any network send; retry can only use these same bytes. */
  async claim(userId: string, id: string, signature: string): Promise<PreparedSwap> {
    const { rows } = await dbPool.query(`UPDATE prepared_solana_swaps SET signature=COALESCE(signature,$3),status='pending',updated_at=NOW()
      WHERE user_id=$1 AND id=$2 AND status IN ('prepared','pending') AND (signature IS NULL OR signature=$3) RETURNING *`, [userId,id,signature]);
    if (!rows[0]) throw new ApiError('Swap is already finalized or has a different signature.', 409, 'SUBMISSION_CONFLICT');
    return row(rows[0]);
  },
  async update(userId: string, id: string, status: PreparedSwap['status'], reason: string | null = null) {
    // A delayed pending response cannot undo a confirmed/failed result from another request.
    await dbPool.query(`UPDATE prepared_solana_swaps SET status=$3,reason=$4,updated_at=NOW()
      WHERE user_id=$1 AND id=$2 AND status NOT IN ('confirmed','failed')
      AND NOT (status='expired' AND $3='pending')`, [userId,id,status,reason]);
  },
};
