import { logger } from './logger';
import { isPostgresConfigured } from './db/pool';
import { pgUserRepository } from './db/user-repository';
import { pgWalletRepository } from './db/wallet-repository';
import { pgPreferencesRepository } from './db/preferences-repository';
import { pgChallengeRepository } from './db/challenge-repository';
import { pgAuditRepository } from './db/audit-repository';
import { pgWalletTransactionRepository } from './db/wallet-transaction-repository';

export interface DbUser {
  id: string;
  email?: string | null;
  displayName: string;
  role: 'user' | 'admin' | 'analyst';
  status: 'active' | 'inactive' | 'suspended' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface DbWallet {
  id: string;
  userId: string;
  address: string;
  network: string;
  label: string;
  isPrimary: boolean;
  balanceSol: number;
  status: 'active' | 'inactive' | 'suspended';
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A confirmed, real, self-custodial transfer the user's own wallet already
 * signed and broadcast independently — a local audit record, never a
 * balance ledger (this platform holds no funds). See
 * db/migrations/021_wallet_transactions.sql and
 * docs/security/threat-model.md's "Wallet transfers" section.
 */
export interface DbWalletTransaction {
  id: string;
  userId: string;
  walletId: string;
  direction: 'SEND';
  asset: 'SOL' | 'USDC';
  amount: number;
  destinationAddress: string;
  signature: string;
  network: string;
  feeLamports?: number;
  createdAt: string;
}

export interface DbUserPreferences {
  userId: string;
  slippageTolerance: number;
  riskLevel: 'conservative' | 'moderate' | 'high' | 'degenerate';
  currencyDisplay: 'USD' | 'SOL' | 'EUR' | 'BTC';
  rpcEndpoint: 'mainnet' | 'devnet' | 'custom';
  customRpcUrl?: string | null;
  theme: 'dark' | 'light' | 'system';
  density: 'compact' | 'standard' | 'spacious';
  autoLockMinutes: number;
  notificationsEnabled: {
    security: boolean;
    priceAlerts: boolean;
    tradeExecution: boolean;
    system: boolean;
  };
  updatedAt: string;
}

export interface DbAuthChallenge {
  id: string;
  address: string;
  nonce: string;
  statement: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Storage-level shape for an audit entry. Deliberately wider than
 * `AuditEventInput` (`lib/server/audit.ts`'s closed action/entityType
 * union) — `recordAuditEvent()` is the strict, security-domain chokepoint
 * most callers should use (and typos in `action` get caught there), but
 * `lib/portfolio/service.ts#recordPortfolioAccess` predates it and writes
 * its own ad-hoc portfolio-access shape directly to this store. A real
 * audit-log table wouldn't enforce an enum at the storage layer either;
 * this mirrors that rather than forcing an unrelated domain's action names
 * into the security-audit union.
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * In-memory fallback state, used only when `DATABASE_URL` isn't configured
 * (e.g. a dev environment without Postgres set up yet). Real requests are
 * served by the `Pg*Repository` classes under `lib/server/db/` once
 * Postgres is configured — see `isPostgresConfigured()` (`./db/pool`). Every public method on
 * `ServerStore` is now async so both paths share one interface; every real
 * call site was updated to `await` them (Phase 1 — Postgres Foundation).
 */
class InMemoryFallback {
  users: Map<string, DbUser> = new Map();
  wallets: Map<string, DbWallet> = new Map();
  walletTransactions: Map<string, DbWalletTransaction> = new Map();
  preferences: Map<string, DbUserPreferences> = new Map();
  challenges: Map<string, DbAuthChallenge> = new Map();
  auditLogs: AuditLogEntry[] = [];

  constructor() {
    const demoUserId = 'user_001';
    const demoWalletAddress = '7xK99zK8mP2xQ5wN3a19';

    this.users.set(demoUserId, {
      id: demoUserId,
      email: 'trader@sentinel.local',
      displayName: 'Sentinel Alpha Trader',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.wallets.set('w_001', {
      id: 'w_001',
      userId: demoUserId,
      address: demoWalletAddress,
      network: 'solana',
      label: 'Phantom Embedded',
      isPrimary: true,
      balanceSol: 42.85,
      status: 'active',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.preferences.set(demoUserId, {
      userId: demoUserId,
      slippageTolerance: 0.5,
      riskLevel: 'moderate',
      currencyDisplay: 'USD',
      rpcEndpoint: 'mainnet',
      theme: 'dark',
      density: 'standard',
      autoLockMinutes: 30,
      notificationsEnabled: {
        security: true,
        priceAlerts: true,
        tradeExecution: true,
        system: true,
      },
      updatedAt: new Date().toISOString(),
    });

    if (process.env.NODE_ENV !== 'production') {
      for (const [id, email, displayName] of [
        ['admin_001', 'admin-a@sentinel.local', 'Sentinel Admin A'],
        ['admin_002', 'admin-b@sentinel.local', 'Sentinel Admin B'],
      ] as const) {
        this.users.set(id, {
          id,
          email,
          displayName,
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
}

// Global instance attached to globalThis in Node runtime to prevent re-instantiation in HMR
const globalForFallback = globalThis as unknown as { serverStoreFallback?: InMemoryFallback };
const mem = globalForFallback.serverStoreFallback ?? new InMemoryFallback();
if (process.env.NODE_ENV !== 'production') globalForFallback.serverStoreFallback = mem;

let warnedFallback = false;
function warnFallbackOnce() {
  if (warnedFallback) return;
  warnedFallback = true;
  logger.warn('[store] DATABASE_URL not configured — falling back to in-memory storage. Data will not persist across restarts.');
}

/**
 * Facade over the identity/wallet/session/audit domain. Delegates to real
 * Postgres repositories (`lib/server/db/*-repository.ts`) when `DATABASE_URL`
 * is set, otherwise falls back to the original in-memory `Map` behavior —
 * see the class-level note above. Every method is async now (Phase 1);
 * every real call site was updated to `await` accordingly.
 */
class ServerStore {
  // Challenge operations
  async saveChallenge(address: string, nonce: string, statement: string, expiresAt: string): Promise<DbAuthChallenge> {
    if (isPostgresConfigured()) return pgChallengeRepository.saveChallenge(address, nonce, statement, expiresAt);
    warnFallbackOnce();
    const id = `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const challenge: DbAuthChallenge = { id, address, nonce, statement, expiresAt, createdAt: new Date().toISOString() };
    mem.challenges.set(nonce, challenge);
    return challenge;
  }

  async getChallengeByNonce(nonce: string): Promise<DbAuthChallenge | undefined> {
    if (isPostgresConfigured()) return pgChallengeRepository.getChallengeByNonce(nonce);
    warnFallbackOnce();
    const challenge = mem.challenges.get(nonce);
    if (!challenge) return undefined;
    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      mem.challenges.delete(nonce);
      return undefined;
    }
    return challenge;
  }

  async consumeChallenge(nonce: string): Promise<void> {
    if (isPostgresConfigured()) return pgChallengeRepository.consumeChallenge(nonce);
    warnFallbackOnce();
    mem.challenges.delete(nonce);
  }

  // User & Wallet operations
  async findWalletByAddress(address: string): Promise<DbWallet | undefined> {
    if (isPostgresConfigured()) return pgWalletRepository.findWalletByAddress(address);
    warnFallbackOnce();
    return Array.from(mem.wallets.values()).find((w) => w.address.toLowerCase() === address.toLowerCase());
  }

  async findUserById(userId: string): Promise<DbUser | undefined> {
    if (isPostgresConfigured()) return pgUserRepository.findUserById(userId);
    warnFallbackOnce();
    return mem.users.get(userId);
  }

  async getUserWallets(userId: string): Promise<DbWallet[]> {
    if (isPostgresConfigured()) return pgWalletRepository.getUserWallets(userId);
    warnFallbackOnce();
    return Array.from(mem.wallets.values()).filter((w) => w.userId === userId);
  }

  async createUserWithWallet(address: string, label = 'Solana Wallet'): Promise<{ user: DbUser; wallet: DbWallet }> {
    if (isPostgresConfigured()) return pgUserRepository.createUserWithWallet(address, label);
    warnFallbackOnce();
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const walletId = `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    const user: DbUser = { id: userId, displayName: `Sentinel User (${shortAddress})`, role: 'user', status: 'active', createdAt: now, updatedAt: now };
    const wallet: DbWallet = {
      id: walletId, userId, address, network: 'solana', label, isPrimary: true, balanceSol: 24.5,
      status: 'active', firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now,
    };
    const defaultPrefs: DbUserPreferences = {
      userId, slippageTolerance: 0.5, riskLevel: 'moderate', currencyDisplay: 'USD', rpcEndpoint: 'mainnet',
      theme: 'dark', density: 'standard', autoLockMinutes: 30,
      notificationsEnabled: { security: true, priceAlerts: true, tradeExecution: true, system: true },
      updatedAt: now,
    };

    mem.users.set(userId, user);
    mem.wallets.set(walletId, wallet);
    mem.preferences.set(userId, defaultPrefs);

    return { user, wallet };
  }

  async addWalletToUser(userId: string, address: string, label = 'Secondary Wallet'): Promise<DbWallet> {
    if (isPostgresConfigured()) return pgWalletRepository.addWalletToUser(userId, address, label);
    warnFallbackOnce();
    const existing = await this.findWalletByAddress(address);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error('Wallet address is already linked to another Sentinel account.');
      }
      return existing;
    }

    const walletId = `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const existingWallets = await this.getUserWallets(userId);
    const isPrimary = existingWallets.length === 0;

    const wallet: DbWallet = {
      id: walletId, userId, address, network: 'solana', label, isPrimary,
      balanceSol: Math.round((Math.random() * 15 + 1) * 100) / 100,
      status: 'active', firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now,
    };

    mem.wallets.set(walletId, wallet);
    return wallet;
  }

  async updateWallet(walletId: string, userId: string, updates: { label?: string; isPrimary?: boolean }): Promise<DbWallet> {
    if (isPostgresConfigured()) return pgWalletRepository.updateWallet(walletId, userId, updates);
    warnFallbackOnce();
    const wallet = mem.wallets.get(walletId);
    if (!wallet || wallet.userId !== userId) {
      throw new Error('Wallet not found or access denied.');
    }

    if (updates.isPrimary) {
      for (const w of mem.wallets.values()) {
        if (w.userId === userId) w.isPrimary = false;
      }
      wallet.isPrimary = true;
    }
    if (updates.label !== undefined) wallet.label = updates.label;

    wallet.updatedAt = new Date().toISOString();
    mem.wallets.set(walletId, wallet);
    return wallet;
  }

  async unlinkWallet(walletId: string, userId: string): Promise<void> {
    if (isPostgresConfigured()) return pgWalletRepository.unlinkWallet(walletId, userId);
    warnFallbackOnce();
    const wallet = mem.wallets.get(walletId);
    if (!wallet || wallet.userId !== userId) {
      throw new Error('Wallet not found or access denied.');
    }

    const userWallets = await this.getUserWallets(userId);
    if (userWallets.length <= 1) {
      throw new Error('Cannot unlink the sole remaining wallet on account.');
    }

    mem.wallets.delete(walletId);

    if (wallet.isPrimary) {
      const remaining = await this.getUserWallets(userId);
      if (remaining.length > 0) {
        remaining[0].isPrimary = true;
        mem.wallets.set(remaining[0].id, remaining[0]);
      }
    }
  }

  // Preferences operations
  async getUserPreferences(userId: string): Promise<DbUserPreferences> {
    if (isPostgresConfigured()) return pgPreferencesRepository.getUserPreferences(userId);
    warnFallbackOnce();
    const prefs = mem.preferences.get(userId);
    if (prefs) return prefs;

    const defaultPrefs: DbUserPreferences = {
      userId, slippageTolerance: 0.5, riskLevel: 'moderate', currencyDisplay: 'USD', rpcEndpoint: 'mainnet',
      theme: 'dark', density: 'standard', autoLockMinutes: 30,
      notificationsEnabled: { security: true, priceAlerts: true, tradeExecution: true, system: true },
      updatedAt: new Date().toISOString(),
    };
    mem.preferences.set(userId, defaultPrefs);
    return defaultPrefs;
  }

  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<DbUserPreferences, 'notificationsEnabled'>> & {
      notificationsEnabled?: Partial<DbUserPreferences['notificationsEnabled']>;
    }
  ): Promise<DbUserPreferences> {
    if (isPostgresConfigured()) return pgPreferencesRepository.updateUserPreferences(userId, updates);
    warnFallbackOnce();
    const current = await this.getUserPreferences(userId);
    const updated: DbUserPreferences = {
      ...current,
      ...updates,
      userId,
      notificationsEnabled: { ...current.notificationsEnabled, ...(updates.notificationsEnabled || {}) },
      updatedAt: new Date().toISOString(),
    };
    mem.preferences.set(userId, updated);
    return updated;
  }

  // Audit logs
  async recordAuditLog(log: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
    if (isPostgresConfigured()) return pgAuditRepository.recordAuditLog(log);
    warnFallbackOnce();
    const entry: AuditLogEntry = { id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...log };
    mem.auditLogs.push(entry);
    if (mem.auditLogs.length > 500) mem.auditLogs.shift();
    return entry;
  }

  async getAuditLogs(filter?: { userId?: string; action?: string; since?: string }): Promise<AuditLogEntry[]> {
    if (isPostgresConfigured()) return pgAuditRepository.getAuditLogs(filter);
    warnFallbackOnce();
    let results = [...mem.auditLogs];
    if (filter?.userId) results = results.filter((l) => l.userId === filter.userId);
    if (filter?.action) results = results.filter((l) => l.action === filter.action);
    if (filter?.since) results = results.filter((l) => Date.parse(l.timestamp) >= Date.parse(filter.since!));
    return results.reverse();
  }

  // Wallet transactions (self-custodial send history — see DbWalletTransaction)
  async recordWalletTransaction(userId: string, data: Omit<DbWalletTransaction, 'id' | 'userId' | 'createdAt'>): Promise<DbWalletTransaction> {
    if (isPostgresConfigured()) return pgWalletTransactionRepository.recordWalletTransaction(userId, data);
    warnFallbackOnce();
    const record: DbWalletTransaction = {
      id: `wtx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      createdAt: new Date().toISOString(),
      ...data,
    };
    mem.walletTransactions.set(record.id, record);
    return record;
  }

  async getWalletTransactions(userId: string, walletId?: string): Promise<DbWalletTransaction[]> {
    if (isPostgresConfigured()) return pgWalletTransactionRepository.getWalletTransactions(userId, walletId);
    warnFallbackOnce();
    const list = Array.from(mem.walletTransactions.values())
      .filter((t) => t.userId === userId && (!walletId || t.walletId === walletId));
    return list.reverse().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async hasSentToAddress(userId: string, destinationAddress: string): Promise<boolean> {
    if (isPostgresConfigured()) return pgWalletTransactionRepository.hasSentToAddress(userId, destinationAddress);
    warnFallbackOnce();
    return Array.from(mem.walletTransactions.values()).some(
      (t) => t.userId === userId && t.destinationAddress === destinationAddress,
    );
  }

  // Role management
  async updateUserRole(userId: string, role: DbUser['role']): Promise<DbUser> {
    if (isPostgresConfigured()) return pgUserRepository.updateUserRole(userId, role);
    warnFallbackOnce();
    const user = mem.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.role = role;
    user.updatedAt = new Date().toISOString();
    return user;
  }

  async listUsers(): Promise<DbUser[]> {
    if (isPostgresConfigured()) return pgUserRepository.listUsers();
    warnFallbackOnce();
    return [...mem.users.values()];
  }

  /**
   * Added while fixing `app/api/v1/user/account/route.ts`'s soft-delete: it
   * previously mutated the object returned by `findUserById` directly, which
   * only "worked" against the in-memory `Map` by accident (mutating a
   * returned reference mutates the stored record too) — a real Postgres row
   * is a fresh plain object per query, so that pattern silently persists
   * nothing. This is the real, explicit write path both backends need.
   */
  async updateUserStatus(userId: string, status: DbUser['status']): Promise<DbUser> {
    if (isPostgresConfigured()) return pgUserRepository.updateUserStatus(userId, status);
    warnFallbackOnce();
    const user = mem.users.get(userId);
    if (!user) throw new Error('User not found.');
    user.status = status;
    user.updatedAt = new Date().toISOString();
    return user;
  }
}

// Global instance attached to globalThis in Node runtime to prevent re-instantiation in HMR
const globalForStore = globalThis as unknown as { serverStore?: ServerStore };
export const serverStore = globalForStore.serverStore ?? new ServerStore();
if (process.env.NODE_ENV !== 'production') globalForStore.serverStore = serverStore;
