import 'server-only';

import { dbPool } from './pool';
import type {
  DbUser,
  DbWallet,
  DbUserSession,
  DbAuthChallenge,
  DbPasswordResetToken,
  DbEmailVerificationToken,
  DbWalletVerification,
  DbSecurityAuditEvent,
} from '@/lib/db/schema';

/**
 * Postgres backing for the `lib/auth/*` service layer (Phase 2 — Auth
 * Hardening).
 *
 * `lib/auth/{auth,session,wallet,audit}-service.ts` already implement real
 * registration, login, password reset, email verification, and wallet
 * linking — but against `lib/db/repository.ts`'s in-memory Maps. This module
 * is the storage swap: same `lib/db/schema.ts` row contracts (snake_case),
 * backed by the real tables from migrations 013/020/023.
 *
 * Note the deliberate overlap with `user-repository.ts`/`wallet-repository.ts`
 * (Phase 1): both target the same `users`/`wallets` tables, because the two
 * halves of this codebase model identity differently — `lib/server/store.ts`
 * uses a camelCase `DbUser` (displayName/role), `lib/db/schema.ts` a
 * snake_case one (username/password_hash). Migrations 013+020 gave the table
 * a superset of both, so they are two views of one row, not two stores.
 */

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

function rowToUser(row: Record<string, any>): DbUser {
  return {
    id: row.id,
    email: row.email ?? undefined,
    username: row.username ?? undefined,
    password_hash: row.password_hash ?? undefined,
    display_name: row.display_name ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : undefined,
    status: row.status,
    role: row.role,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_login_at: row.last_login_at ? toIso(row.last_login_at) : undefined,
  };
}

function rowToWallet(row: Record<string, any>): DbWallet {
  return {
    id: row.id,
    user_id: row.user_id,
    chain: row.chain,
    address: row.address,
    label: row.label ?? undefined,
    wallet_type: row.wallet_type ?? undefined,
    is_primary: row.is_primary,
    status: row.status ?? undefined,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function rowToSession(row: Record<string, any>): DbUserSession {
  return {
    id: row.id,
    user_id: row.user_id,
    token_hash: row.token_hash ?? undefined,
    ip_address: row.ip ?? null,
    user_agent: row.user_agent ?? null,
    created_at: toIso(row.created_at),
    last_activity_at: toIso(row.last_seen_at),
    expires_at: toIso(row.expires_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    revoked_reason: row.revoked_reason ?? null,
  } as DbUserSession;
}

export class PgAuthRepository {
  // ── Users ────────────────────────────────────────────────────────────────
  async getUser(userId: string): Promise<DbUser | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return rows[0] ? rowToUser(rows[0]) : undefined;
  }

  /** Full upsert — `lib/auth/*` mutates a fetched row then calls saveUser. */
  async saveUser(user: DbUser): Promise<DbUser> {
    const { rows } = await dbPool.query<Record<string, any>>(
      // Every parameter is explicitly cast: Postgres cannot infer a type for a
      // parameter that only ever appears inside COALESCE/ON CONFLICT, and fails
      // the whole statement with "could not determine data type of parameter $N".
      `INSERT INTO users (id, email, username, password_hash, display_name, avatar_url, email_verified_at, status, role, created_at, updated_at, last_login_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, COALESCE($5::varchar, 'Trader'), $6::varchar,
               $7::timestamptz, $8::varchar, $9::varchar, COALESCE($10::timestamptz, NOW()), NOW(), $11::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         avatar_url = EXCLUDED.avatar_url,
         email_verified_at = EXCLUDED.email_verified_at,
         status = EXCLUDED.status,
         role = EXCLUDED.role,
         updated_at = NOW(),
         last_login_at = EXCLUDED.last_login_at
       RETURNING *`,
      [
        user.id,
        user.email ?? null,
        user.username ?? null,
        user.password_hash ?? null,
        user.display_name ?? null,
        user.avatar_url ?? null,
        user.email_verified_at ?? null,
        user.status,
        user.role,
        user.created_at ?? null,
        user.last_login_at ?? null,
      ],
    );
    return rowToUser(rows[0]);
  }

  // ── Wallets ──────────────────────────────────────────────────────────────
  async getWallet(walletId: string): Promise<DbWallet | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>('SELECT * FROM wallets WHERE id = $1', [walletId]);
    return rows[0] ? rowToWallet(rows[0]) : undefined;
  }

  async getWalletByAddress(address: string, chain?: string): Promise<DbWallet | undefined> {
    const { rows } = chain
      ? await dbPool.query<Record<string, any>>(
          'SELECT * FROM wallets WHERE LOWER(address) = LOWER($1) AND chain = $2 LIMIT 1',
          [address, chain],
        )
      : await dbPool.query<Record<string, any>>('SELECT * FROM wallets WHERE LOWER(address) = LOWER($1) LIMIT 1', [address]);
    return rows[0] ? rowToWallet(rows[0]) : undefined;
  }

  async getUserWallets(userId: string): Promise<DbWallet[]> {
    const { rows } = await dbPool.query<Record<string, any>>(
      'SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return rows.map(rowToWallet);
  }

  async saveWallet(wallet: DbWallet): Promise<DbWallet> {
    const { rows } = await dbPool.query<Record<string, any>>(
      `INSERT INTO wallets (id, user_id, chain, address, label, wallet_type, is_primary, status, created_at, updated_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, COALESCE($6::varchar, 'external'), $7::boolean, COALESCE($8::varchar, 'active'), COALESCE($9::timestamptz, NOW()), NOW())
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         wallet_type = EXCLUDED.wallet_type,
         is_primary = EXCLUDED.is_primary,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        wallet.id,
        wallet.user_id,
        wallet.chain,
        wallet.address,
        wallet.label ?? null,
        wallet.wallet_type ?? null,
        wallet.is_primary,
        wallet.status ?? null,
        wallet.created_at ?? null,
      ],
    );
    return rowToWallet(rows[0]);
  }

  /** Exactly one default wallet per user — enforced in one transaction. */
  async setDefaultWallet(userId: string, walletId: string): Promise<void> {
    await dbPool.withTransaction(async (client) => {
      await client.query('UPDATE wallets SET is_primary = FALSE WHERE user_id = $1', [userId]);
      await client.query('UPDATE wallets SET is_primary = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2', [
        walletId,
        userId,
      ]);
    });
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  async getSession(sessionId: string): Promise<DbUserSession | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    return rows[0] ? rowToSession(rows[0]) : undefined;
  }

  async getUserSessions(userId: string): Promise<DbUserSession[]> {
    const { rows } = await dbPool.query<Record<string, any>>(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(rowToSession);
  }

  async saveSession(session: DbUserSession): Promise<DbUserSession> {
    const { rows } = await dbPool.query<Record<string, any>>(
      `INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at, revoked_reason, revoked)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::text, COALESCE($6::timestamptz, NOW()), COALESCE($7::timestamptz, NOW()), $8::timestamptz, $9::timestamptz, $10::varchar, $9::timestamptz IS NOT NULL)
       ON CONFLICT (id) DO UPDATE SET
         token_hash = EXCLUDED.token_hash,
         last_seen_at = EXCLUDED.last_seen_at,
         revoked_at = EXCLUDED.revoked_at,
         revoked_reason = EXCLUDED.revoked_reason,
         revoked = EXCLUDED.revoked
       RETURNING *`,
      [
        session.id,
        session.user_id,
        session.token_hash ?? null,
        session.ip_address ?? null,
        session.user_agent ?? null,
        session.created_at ?? null,
        session.last_activity_at ?? null,
        session.expires_at,
        session.revoked_at ?? null,
        session.revoked_reason ?? null,
      ],
    );
    return rowToSession(rows[0]);
  }

  async revokeSession(sessionId: string, reason: string): Promise<boolean> {
    const { rows } = await dbPool.query(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $2
       WHERE id = $1 AND revoked = FALSE RETURNING id`,
      [sessionId, reason],
    );
    return rows.length > 0;
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string, reason?: string): Promise<number> {
    const { rows } = await dbPool.query(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $3
       WHERE user_id = $1 AND revoked = FALSE AND ($2::VARCHAR IS NULL OR id != $2)
       RETURNING id`,
      [userId, exceptSessionId ?? null, reason ?? null],
    );
    return rows.length;
  }

  // ── Auth challenges (SIWS) ───────────────────────────────────────────────
  async saveAuthChallenge(challenge: DbAuthChallenge): Promise<DbAuthChallenge> {
    const { rows } = await dbPool.query<Record<string, any>>(
      `INSERT INTO auth_challenges (id, user_id, wallet_address, chain_id, nonce, message, message_hash, expires_at, used_at, created_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::text, $7::varchar, $8::timestamptz, $9::timestamptz, COALESCE($10::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET used_at = EXCLUDED.used_at
       RETURNING *`,
      [
        challenge.id,
        challenge.user_id ?? null,
        challenge.wallet_address,
        challenge.chain_id,
        challenge.nonce,
        challenge.message,
        challenge.message_hash ?? null,
        challenge.expires_at,
        challenge.used_at ?? null,
        challenge.created_at ?? null,
      ],
    );
    const row = rows[0];
    return {
      ...row,
      expires_at: toIso(row.expires_at),
      created_at: toIso(row.created_at),
      used_at: toIsoOrNull(row.used_at),
    } as DbAuthChallenge;
  }

  async getAuthChallenge(challengeId: string): Promise<DbAuthChallenge | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>('SELECT * FROM auth_challenges WHERE id = $1', [challengeId]);
    if (!rows[0]) return undefined;
    const row = rows[0];
    return {
      ...row,
      expires_at: toIso(row.expires_at),
      created_at: toIso(row.created_at),
      used_at: toIsoOrNull(row.used_at),
    } as DbAuthChallenge;
  }

  async saveWalletVerification(verification: DbWalletVerification): Promise<void> {
    await dbPool.query(
      `INSERT INTO wallet_verifications (id, wallet_id, challenge_id, verified_at, method, metadata)
       VALUES ($1::varchar, $2::varchar, $3::varchar, COALESCE($4::timestamptz, NOW()), $5::varchar, $6::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        verification.id,
        verification.wallet_id,
        verification.challenge_id,
        verification.verified_at ?? null,
        verification.method,
        verification.metadata ? JSON.stringify(verification.metadata) : null,
      ],
    );
  }

  // ── Password reset / email verification tokens ───────────────────────────
  async savePasswordResetToken(token: DbPasswordResetToken): Promise<void> {
    await dbPool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::timestamptz, $5::timestamptz, COALESCE($6::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET used_at = EXCLUDED.used_at`,
      [token.id, token.user_id, token.token_hash, token.expires_at, token.used_at ?? null, token.created_at ?? null],
    );
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<DbPasswordResetToken | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (!rows[0]) return undefined;
    const row = rows[0];
    return { ...row, expires_at: toIso(row.expires_at), created_at: toIso(row.created_at), used_at: toIsoOrNull(row.used_at) } as DbPasswordResetToken;
  }

  async saveEmailVerificationToken(token: DbEmailVerificationToken): Promise<void> {
    await dbPool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, new_email, expires_at, used_at, created_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::timestamptz, $6::timestamptz, COALESCE($7::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET used_at = EXCLUDED.used_at`,
      [
        token.id,
        token.user_id,
        token.token_hash,
        token.new_email ?? null,
        token.expires_at,
        token.used_at ?? null,
        token.created_at ?? null,
      ],
    );
  }

  async getEmailVerificationTokenByHash(tokenHash: string): Promise<DbEmailVerificationToken | undefined> {
    const { rows } = await dbPool.query<Record<string, any>>(
      'SELECT * FROM email_verification_tokens WHERE token_hash = $1',
      [tokenHash],
    );
    if (!rows[0]) return undefined;
    const row = rows[0];
    return { ...row, expires_at: toIso(row.expires_at), created_at: toIso(row.created_at), used_at: toIsoOrNull(row.used_at) } as DbEmailVerificationToken;
  }

  // ── Security audit events ────────────────────────────────────────────────
  async saveSecurityAuditEvent(event: DbSecurityAuditEvent): Promise<void> {
    await dbPool.query(
      `INSERT INTO security_audit_events (id, user_id, action, severity, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
       VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::jsonb, $8::varchar, $9::text, COALESCE($10::timestamptz, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.user_id ?? null,
        event.action,
        event.severity,
        event.entity_type,
        event.entity_id ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.ip_address ?? null,
        event.user_agent ?? null,
        event.created_at ?? null,
      ],
    );
  }

  async getSecurityAuditEvents(filter?: { userId?: string; limit?: number }): Promise<DbSecurityAuditEvent[]> {
    const params: unknown[] = [];
    let where = '';
    if (filter?.userId) {
      params.push(filter.userId);
      where = `WHERE user_id = $${params.length}`;
    }
    params.push(filter?.limit ?? 200);
    const { rows } = await dbPool.query<Record<string, any>>(
      `SELECT * FROM security_audit_events ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((row) => ({ ...row, created_at: toIso(row.created_at) })) as DbSecurityAuditEvent[];
  }
}

export const pgAuthRepository = new PgAuthRepository();
