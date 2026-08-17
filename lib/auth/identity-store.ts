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
import { isPostgresConfigured } from '../server/db/pool';
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

  // ── Users ────────────────────────────────────────────────────────────────
  async getUser(id: string): Promise<DbUser | undefined> {
    if (this.usePg()) return pgAuthRepository.getUser(id);
    return dbRepository.getUser(id);
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    if (this.usePg()) return pgAuthRepository.getUserByEmail(email);
    return dbRepository.getUserByEmail(email);
  }

  async saveUser(user: DbUser): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveUser(user);
      return;
    }
    dbRepository.saveUser(user);
  }

  // ── Wallets ──────────────────────────────────────────────────────────────
  async getWallet(id: string): Promise<DbWallet | undefined> {
    if (this.usePg()) return pgAuthRepository.getWallet(id);
    return dbRepository.getWallet(id);
  }

  async getWalletByAddress(address: string, chain?: string): Promise<DbWallet | undefined> {
    if (this.usePg()) return pgAuthRepository.getWalletByAddress(address, chain);
    return dbRepository.getWalletByAddress(address, chain);
  }

  async getUserWallets(userId: string): Promise<DbWallet[]> {
    if (this.usePg()) return pgAuthRepository.getUserWallets(userId);
    return dbRepository.getUserWallets(userId);
  }

  async saveWallet(wallet: DbWallet): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveWallet(wallet);
      return;
    }
    dbRepository.saveWallet(wallet);
  }

  async setDefaultWallet(userId: string, walletId: string): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.setDefaultWallet(userId, walletId);
      return;
    }
    dbRepository.setDefaultWallet(userId, walletId);
  }

  async saveWalletVerification(verification: DbWalletVerification): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveWalletVerification(verification);
      return;
    }
    dbRepository.saveWalletVerification(verification);
  }

  // ── Sessions ─────────────────────────────────────────────────────────────
  async getSession(id: string): Promise<DbUserSession | undefined> {
    if (this.usePg()) return pgAuthRepository.getSession(id);
    return dbRepository.getSession(id);
  }

  async getUserSessions(userId: string): Promise<DbUserSession[]> {
    if (this.usePg()) return pgAuthRepository.getUserSessions(userId);
    return dbRepository.getUserSessions(userId);
  }

  async saveSession(session: DbUserSession): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveSession(session);
      return;
    }
    dbRepository.saveSession(session);
  }

  async revokeSession(id: string, reason?: string): Promise<boolean> {
    if (this.usePg()) return pgAuthRepository.revokeSession(id, reason || 'User requested logout');
    return dbRepository.revokeSession(id, reason);
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string, reason?: string): Promise<number> {
    if (this.usePg()) return pgAuthRepository.revokeAllUserSessions(userId, exceptSessionId, reason);
    return dbRepository.revokeAllUserSessions(userId, exceptSessionId, reason);
  }

  // ── SIWS challenges ──────────────────────────────────────────────────────
  async saveAuthChallenge(challenge: DbAuthChallenge): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveAuthChallenge(challenge);
      return;
    }
    dbRepository.saveAuthChallenge(challenge);
  }

  async getAuthChallenge(id: string): Promise<DbAuthChallenge | undefined> {
    if (this.usePg()) return pgAuthRepository.getAuthChallenge(id);
    return dbRepository.getAuthChallenge(id);
  }

  // ── Password reset / email verification ──────────────────────────────────
  async savePasswordResetToken(token: DbPasswordResetToken): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.savePasswordResetToken(token);
      return;
    }
    dbRepository.savePasswordResetToken(token);
  }

  async getPasswordResetTokenByHash(hash: string): Promise<DbPasswordResetToken | undefined> {
    if (this.usePg()) return pgAuthRepository.getPasswordResetTokenByHash(hash);
    return dbRepository.getPasswordResetTokenByHash(hash);
  }

  async saveEmailVerificationToken(token: DbEmailVerificationToken): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveEmailVerificationToken(token);
      return;
    }
    dbRepository.saveEmailVerificationToken(token);
  }

  async getEmailVerificationTokenByHash(hash: string): Promise<DbEmailVerificationToken | undefined> {
    if (this.usePg()) return pgAuthRepository.getEmailVerificationTokenByHash(hash);
    return dbRepository.getEmailVerificationTokenByHash(hash);
  }

  // ── Security audit ───────────────────────────────────────────────────────
  async saveSecurityAuditEvent(event: DbSecurityAuditEvent): Promise<void> {
    if (this.usePg()) {
      await pgAuthRepository.saveSecurityAuditEvent(event);
      return;
    }
    dbRepository.saveSecurityAuditEvent(event);
  }

  async getSecurityAuditEvents(userId?: string): Promise<DbSecurityAuditEvent[]> {
    if (this.usePg()) return pgAuthRepository.getSecurityAuditEvents({ userId });
    return dbRepository.getSecurityAuditEvents(userId);
  }
}

export const identityStore = new IdentityStore();
