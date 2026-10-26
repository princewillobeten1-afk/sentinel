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

    const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured — cannot open a Postgres connection.');
    }

    const isCloudPostgres =
      databaseUrl.includes('supabase.co') ||
      databaseUrl.includes('pooler.supabase.com') ||
      databaseUrl.includes('sslmode=require') ||
      databaseUrl.includes('neon.tech') ||
      databaseUrl.includes('amazonaws.com');

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : undefined,
      // Without these, an unreachable or paused host leaves every awaiting
      // request hanging indefinitely: the route never responds, the browser
      // fetch never settles, and the UI shows a spinner that can never resolve.
      // Failing is recoverable; hanging is not.
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
      idleTimeoutMillis: 30_000,
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
    try {
      const pool = this.getPool();
      // `pg`'s own generic requires `T extends QueryResultRow` (an indexed-
      // signature interface); our Row types are plain, precisely-typed
      // interfaces instead, so the result is cast at this one boundary rather
      // than threading pg's constraint through every repository file.
      const result = await pool.query(text, params);
      return result as unknown as { rows: T[] };
    } catch (err) {
      if (isDbConnectionError(err)) {
        markPostgresUnavailable(err);
      }
      throw err;
    }
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    try {
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
    } catch (err) {
      if (isDbConnectionError(err)) {
        markPostgresUnavailable(err);
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

const globalForDb = globalThis as unknown as {
  dbPool?: DatabasePool;
  postgresUnreachableUntil?: number;
  lastWarnedAt?: number;
};

export const dbPool = globalForDb.dbPool ?? new DatabasePool();
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = dbPool;

export function isDbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as any;
  const code = anyErr.code;
  const msg = String(anyErr.message || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connect ECONNREFUSED') ||
    msg.includes('Connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('ETIMEDOUT')
  );
}

export function markPostgresUnavailable(err?: unknown): void {
  globalForDb.postgresUnreachableUntil = Date.now() + 30_000;
  if (!globalForDb.lastWarnedAt || Date.now() - globalForDb.lastWarnedAt > 30_000) {
    globalForDb.lastWarnedAt = Date.now();
    logger.warn('[db] Postgres unreachable — degrading to in-memory store for 30s', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** True when a real Postgres connection is configured and reachable. */
export function isPostgresConfigured(): boolean {
  if (!env.DATABASE_URL) return false;
  if (globalForDb.postgresUnreachableUntil && Date.now() < globalForDb.postgresUnreachableUntil) {
    return false;
  }
  return true;
}
