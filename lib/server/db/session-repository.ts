import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { ServerSession, CreateSessionInput } from '@/lib/server/session-store';

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  mfa_verified: boolean;
}

function rowToSession(row: SessionRow): ServerSession {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: new Date(row.created_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    ip: row.ip,
    userAgent: row.user_agent,
    revoked: row.revoked,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    revokedReason: row.revoked_reason,
    mfaVerified: row.mfa_verified,
  };
}

/**
 * Postgres-backed replacement for `SessionStore`'s in-memory Map. Method
 * names and return shapes mirror `lib/server/session-store.ts` exactly
 * (Phase 1's interface-freeze contract).
 */
export class PgSessionRepository {
  async create(userId: string, input: CreateSessionInput): Promise<ServerSession> {
    const id = generateId('sess');
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
    const { rows } = await dbPool.query<SessionRow>(
      `INSERT INTO sessions (id, user_id, ip, user_agent, expires_at, mfa_verified, revoked)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING *`,
      [id, userId, input.ip, input.userAgent, expiresAt, input.mfaVerified],
    );
    return rowToSession(rows[0] as SessionRow);
  }

  async get(id: string): Promise<ServerSession | undefined> {
    const { rows } = await dbPool.query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [id]);
    return rows[0] ? rowToSession(rows[0]) : undefined;
  }

  async isValid(id: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;
    if (session.revoked) return false;
    if (Date.parse(session.expiresAt) < Date.now()) return false;
    return true;
  }

  async touch(id: string): Promise<void> {
    await dbPool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [id]);
  }

  async revoke(id: string, reason?: string): Promise<boolean> {
    const { rows } = await dbPool.query(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $2
       WHERE id = $1 AND revoked = FALSE
       RETURNING id`,
      [id, reason ?? null],
    );
    return rows.length > 0;
  }

  async revokeAllForUser(userId: string, opts: { exceptSessionId?: string; reason?: string } = {}): Promise<number> {
    const { rows } = await dbPool.query(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $3
       WHERE user_id = $1 AND revoked = FALSE AND ($2::VARCHAR IS NULL OR id != $2)
       RETURNING id`,
      [userId, opts.exceptSessionId ?? null, opts.reason ?? null],
    );
    return rows.length;
  }

  async listForUser(userId: string): Promise<ServerSession[]> {
    const { rows } = await dbPool.query<SessionRow>(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_seen_at DESC',
      [userId],
    );
    return rows.map(rowToSession);
  }

  async hasSeenDeviceBefore(
    userId: string,
    opts: { ip: string | null; userAgent: string | null; excludeSessionId?: string },
  ): Promise<boolean> {
    const { rows } = await dbPool.query(
      `SELECT 1 FROM sessions
       WHERE user_id = $1
         AND ($4::VARCHAR IS NULL OR id != $4)
         AND ((($2::VARCHAR IS NOT NULL) AND ip = $2) OR (($3::VARCHAR IS NOT NULL) AND user_agent = $3))
       LIMIT 1`,
      [userId, opts.ip, opts.userAgent, opts.excludeSessionId ?? null],
    );
    return rows.length > 0;
  }
}

export const pgSessionRepository = new PgSessionRepository();
