/**
 * Server-side session tracking (Sprint 30 — Tier 2; Postgres-backed as of
 * Phase 1 — Postgres Foundation).
 *
 * Sessions issued today are stateless JWTs with no way to revoke one before
 * it naturally expires — logout only clears the client-side cookie. This
 * store gives every issued token a corresponding server-side record (`sid`
 * embedded in the JWT payload, see `lib/server/auth.ts`), so revocation,
 * device listing, and "log out of all devices" become real rather than
 * aspirational.
 *
 * Delegates to `lib/server/db/session-repository.ts` (real Postgres) when
 * `DATABASE_URL` is configured, otherwise falls back to the original
 * in-memory `Map` behavior — same facade pattern as `lib/server/store.ts`.
 * Every method is async now; every real call site was updated to `await`
 * accordingly (Phase 1).
 */

import { generateId } from './id';
import { logger } from './logger';
import { isPostgresConfigured } from './db/pool';
import { pgSessionRepository } from './db/session-repository';

export interface ServerSession {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  revoked: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
  mfaVerified: boolean;
}

export interface CreateSessionInput {
  ip: string | null;
  userAgent: string | null;
  expiresInSeconds: number;
  mfaVerified: boolean;
}

let warnedFallback = false;
function warnFallbackOnce() {
  if (warnedFallback) return;
  warnedFallback = true;
  logger.warn('[session-store] DATABASE_URL not configured — falling back to in-memory sessions. Sessions will not persist across restarts.');
}

class SessionStore {
  private sessionsById = new Map<string, ServerSession>();

  private usePostgres(): boolean {
    return isPostgresConfigured();
  }

  async create(userId: string, input: CreateSessionInput): Promise<ServerSession> {
    if (this.usePostgres()) return pgSessionRepository.create(userId, input);
    warnFallbackOnce();
    const now = new Date();
    const session: ServerSession = {
      id: generateId('sess'),
      userId,
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000).toISOString(),
      ip: input.ip,
      userAgent: input.userAgent,
      revoked: false,
      revokedAt: null,
      revokedReason: null,
      mfaVerified: input.mfaVerified,
    };
    this.sessionsById.set(session.id, session);
    return session;
  }

  async get(id: string): Promise<ServerSession | undefined> {
    if (this.usePostgres()) return pgSessionRepository.get(id);
    warnFallbackOnce();
    return this.sessionsById.get(id);
  }

  /** True when the session exists, isn't revoked, and hasn't expired — the actual revocation-enforcement check. */
  async isValid(id: string): Promise<boolean> {
    if (this.usePostgres()) return pgSessionRepository.isValid(id);
    warnFallbackOnce();
    const session = this.sessionsById.get(id);
    if (!session) return false;
    if (session.revoked) return false;
    if (Date.parse(session.expiresAt) < Date.now()) return false;
    return true;
  }

  async touch(id: string): Promise<void> {
    if (this.usePostgres()) return pgSessionRepository.touch(id);
    warnFallbackOnce();
    const session = this.sessionsById.get(id);
    if (!session) return;
    session.lastSeenAt = new Date().toISOString();
  }

  async revoke(id: string, reason?: string): Promise<boolean> {
    if (this.usePostgres()) return pgSessionRepository.revoke(id, reason);
    warnFallbackOnce();
    const session = this.sessionsById.get(id);
    if (!session || session.revoked) return false;
    session.revoked = true;
    session.revokedAt = new Date().toISOString();
    session.revokedReason = reason ?? null;
    return true;
  }

  /** Revokes every active session for a user, optionally sparing one (e.g. the caller's own session). Returns the count revoked. */
  async revokeAllForUser(userId: string, opts: { exceptSessionId?: string; reason?: string } = {}): Promise<number> {
    if (this.usePostgres()) return pgSessionRepository.revokeAllForUser(userId, opts);
    warnFallbackOnce();
    let count = 0;
    for (const session of this.sessionsById.values()) {
      if (session.userId !== userId) continue;
      if (session.revoked) continue;
      if (opts.exceptSessionId && session.id === opts.exceptSessionId) continue;
      session.revoked = true;
      session.revokedAt = new Date().toISOString();
      session.revokedReason = opts.reason ?? null;
      count += 1;
    }
    return count;
  }

  async listForUser(userId: string): Promise<ServerSession[]> {
    if (this.usePostgres()) return pgSessionRepository.listForUser(userId);
    warnFallbackOnce();
    return [...this.sessionsById.values()]
      .filter((session) => session.userId === userId)
      .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
  }

  /** Has this user ever had a valid (non-revoked at the time) session from this IP or user agent before `beforeSessionId`? Used for new-device detection. */
  async hasSeenDeviceBefore(userId: string, opts: { ip: string | null; userAgent: string | null; excludeSessionId?: string }): Promise<boolean> {
    if (this.usePostgres()) return pgSessionRepository.hasSeenDeviceBefore(userId, opts);
    warnFallbackOnce();
    for (const session of this.sessionsById.values()) {
      if (session.userId !== userId) continue;
      if (opts.excludeSessionId && session.id === opts.excludeSessionId) continue;
      if (opts.ip && session.ip === opts.ip) return true;
      if (opts.userAgent && session.userAgent === opts.userAgent) return true;
    }
    return false;
  }
}

const globalForSessions = globalThis as unknown as { sessionStore?: SessionStore };
export const sessionStore = globalForSessions.sessionStore ?? new SessionStore();
if (process.env.NODE_ENV !== 'production') globalForSessions.sessionStore = sessionStore;
