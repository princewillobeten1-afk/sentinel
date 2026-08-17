import 'server-only';

import { Pool, type PoolClient } from 'pg';
import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';

/**
 * Real Postgres connection pool (Phase 1 — Postgres Foundation). `globalThis`-
 * guarded singleton, same survives-HMR pattern as `lib/server/store.ts`.
 * Lazily constructed so importing this module never throws just because
 * `DATABASE_URL` isn't configured yet — the first real query is where a
 * missing config surfaces, matching `lib/wallet/balance.ts`'s lazy-Connection
 * precedent.
 */
class DatabasePool {
  private pool: Pool | null = null;

  private getPool(): Pool {
    if (this.pool) return this.pool;

    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured — cannot open a Postgres connection.');
    }

    const isCloudPostgres =
      env.DATABASE_URL.includes('supabase.co') ||
      env.DATABASE_URL.includes('pooler.supabase.com') ||
      env.DATABASE_URL.includes('sslmode=require') ||
      env.DATABASE_URL.includes('neon.tech') ||
      env.DATABASE_URL.includes('amazonaws.com');

    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
    });
    this.pool.on('error', (err) => {
      logger.error('[db] idle client error', { message: err.message });
    });
    return this.pool;
  }

  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    const pool = this.getPool();
    // `pg`'s own generic requires `T extends QueryResultRow` (an indexed-
    // signature interface); our Row types are plain, precisely-typed
    // interfaces instead, so the result is cast at this one boundary rather
    // than threading pg's constraint through every repository file.
    const result = await pool.query(text, params);
    return result as unknown as { rows: T[] };
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

const globalForDb = globalThis as unknown as { dbPool?: DatabasePool };
export const dbPool = globalForDb.dbPool ?? new DatabasePool();
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = dbPool;

/** True when a real Postgres connection is configured — the facade's on/off switch. */
export function isPostgresConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}
