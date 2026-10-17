/**
 * Identity storage adapter for the `lib/auth/*` service layer
 * (Phase 2 — Auth Hardening).
 *
 * WHY THIS EXISTS RATHER THAN CHANGING `lib/db/repository.ts` DIRECTLY:
 * `ProductionDatabaseRepository` owns 16 domains, only one of which (identity)
 * is moving to Postgres in this phase. Routing the auth services through this
 * adapter keeps that file untouched — no half-async class where identity
 * methods return promises and the other fifteen domains don't, and no
 * collision with the parallel work that also edits it.
 *
 * Two backends, one interface:
 *   - `DATABASE_URL` set  → `pgAuthRepository` (real Postgres, migrations
 *     013/020/023).
 *   - unset               → delegates to `dbRepository`'s existing in-memory
 *     Maps, deliberately: `lib/auth/__tests__/*` seed and assert through
 *     `dbRepository` directly (`dbRepository.reset()`,
 *     `dbRepository.getUser(...)`), so the fallback must write to those same
 *     Maps for those tests to keep passing unmodified.
 *
 * Every method is async so both backends share one shape. Callers in
 * `lib/auth/*` are already `async`, so this only costs an `await`.
 */

import { dbRepository } from '../db/repository';
import { isPostgresConfigured, isDbConnectionError, markPostgresUnavailable } from '../server/db/pool';
import { pgAuthRepository } from '../server/db/auth-repository';
import type {
  DbUser,
  DbWallet,
  DbUserSession,
  DbAuthChallenge,
  DbPasswordResetToken,
  DbEmailVerificationToken,
  DbWalletVerification,
  DbSecurityAuditEvent,
} from '../db/schema';

class IdentityStore {
  private usePg(): boolean {
    return isPostgresConfigured();
  }

  private async withFallback<T>(pgFn: () => Promise<T>, fallbackFn: () => T | Promise<T>): Promise<T> {
    if (!this.usePg()) {
      return fallbackFn();
    }
    try {
      return await pgFn();
    } catch (err: unknown) {
      if (isDbConnectionError(err)) {
        markPostgresUnavailable(err);
        return fallbackFn();
      }
      throw err;
    }
  }

  // ── Users ────────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<DbUser | undefined> {
    return this.withFallback(() => pgAuthRepository.getUser(id), () => dbRepository.getUser(id));
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    return this.withFallback(() => pgAuthRepository.getUserByEmail(email), () => dbRepository.getUserByEmail(email));
  }

  async saveUser(user: DbUser): Promise<void> {
    await this.withFallback(
      async () => { await pgAuthRepository.saveUser(user); },
      () => { dbRepository.saveUser(user); }
    );
  }

  // ── Wallets ──────────────────────────────────────────────────────────────
  async getWallet(id: string): Promise<DbWallet | undefined> {
    return this.withFallback(() => pgAuthRepository.getWallet(id), () => dbRepository.getWallet(id));
  }

  async getWalletByAddress(address: string, chain?: string): Promise<DbWallet | undefined> {
    return this.withFallback(() => pgAuthRepository.getWalletByAddress(address, chain), () => dbRepository.getWalletByAddress(address, chain));
  }

  async getUserWallets(userId: string): Promise<DbWallet[]> {
    return this.withFallback(() => pgAuthRepository.getUserWallets(userId), () => dbRepository.getUserWallets(userId));
  }

  async saveWallet(wallet: DbWallet): Promise<void> {
    await this.withFallback(
      async () => { await pgAuthRepository.saveWallet(wallet); },
      () => { dbRepository.saveWallet(wallet); }
    );
  }

  async setDefaultWallet(userId: string, walletId: string): Promise<void> {
    await this.withFallback(
      () => pgAuthRepository.setDefaultWallet(userId, walletId),
      () => { dbRepository.setDefaultWallet(userId, walletId); }
    );
  }

  async saveWalletVerification(verification: DbWalletVerification): Promise<void> {
    await this.withFallback(
      () => pgAuthRepository.saveWalletVerification(verification),
      () => { dbRepository.saveWalletVerification(verification); }
    );
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  async getSession(id: string): Promise<DbUserSession | undefined> {
    return this.withFallback(() => pgAuthRepository.getSession(id), () => dbRepository.getSession(id));
  }

  async getUserSessions(userId: string): Promise<DbUserSession[]> {
    return this.withFallback(() => pgAuthRepository.getUserSessions(userId), () => dbRepository.getUserSessions(userId));
  }

  async saveSession(session: DbUserSession): Promise<void> {
    await this.withFallback(
      async () => { await pgAuthRepository.saveSession(session); },
      () => { dbRepository.saveSession(session); }
    );
  }

  async revokeSession(id: string, reason?: string): Promise<boolean> {
    return this.withFallback(
      () => pgAuthRepository.revokeSession(id, reason || 'User requested logout'),
      () => dbRepository.revokeSession(id, reason)
    );
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string, reason?: string): Promise<number> {
    return this.withFallback(
      () => pgAuthRepository.revokeAllUserSessions(userId, exceptSessionId, reason),
      () => dbRepository.revokeAllUserSessions(userId, exceptSessionId, reason)
    );
  }

  // ── SIWS challenges ──────────────────────────────────────────────────────
  async saveAuthChallenge(challenge: DbAuthChallenge): Promise<void> {
    await this.withFallback(
      async () => { await pgAuthRepository.saveAuthChallenge(challenge); },
      () => { dbRepository.saveAuthChallenge(challenge); }
    );
  }

  async getAuthChallenge(id: string): Promise<DbAuthChallenge | undefined> {
    return this.withFallback(() => pgAuthRepository.getAuthChallenge(id), () => dbRepository.getAuthChallenge(id));
  }

  // ── Password reset / email verification ──────────────────────────────────
  async savePasswordResetToken(token: DbPasswordResetToken): Promise<void> {
    await this.withFallback(
      () => pgAuthRepository.savePasswordResetToken(token),
      () => { dbRepository.savePasswordResetToken(token); }
    );
  }

  async getPasswordResetTokenByHash(hash: string): Promise<DbPasswordResetToken | undefined> {
    return this.withFallback(() => pgAuthRepository.getPasswordResetTokenByHash(hash), () => dbRepository.getPasswordResetTokenByHash(hash));
  }

  async saveEmailVerificationToken(token: DbEmailVerificationToken): Promise<void> {
    await this.withFallback(
      () => pgAuthRepository.saveEmailVerificationToken(token),
      () => { dbRepository.saveEmailVerificationToken(token); }
    );
  }

  async getEmailVerificationTokenByHash(hash: string): Promise<DbEmailVerificationToken | undefined> {
    return this.withFallback(() => pgAuthRepository.getEmailVerificationTokenByHash(hash), () => dbRepository.getEmailVerificationTokenByHash(hash));
  }

  // ── Security audit ───────────────────────────────────────────────────────
  async saveSecurityAuditEvent(event: DbSecurityAuditEvent): Promise<void> {
    await this.withFallback(
      () => pgAuthRepository.saveSecurityAuditEvent(event),
      () => { dbRepository.saveSecurityAuditEvent(event); }
    );
  }

  async getSecurityAuditEvents(userId?: string): Promise<DbSecurityAuditEvent[]> {
    return this.withFallback(() => pgAuthRepository.getSecurityAuditEvents({ userId }), () => dbRepository.getSecurityAuditEvents(userId));
  }
}

export const identityStore = new IdentityStore();
