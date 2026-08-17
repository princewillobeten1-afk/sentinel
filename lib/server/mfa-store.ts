/**
 * MFA enrollment storage (Sprint 30 — Tier 2). In-memory, `globalThis`-guarded
 * — same pattern as `lib/server/session-store.ts`.
 *
 * TOTP secrets are stored in plaintext here, not hashed — HMAC needs the
 * plaintext secret to compute the expected code on every verification, so
 * (unlike API key secrets, which are one-way hashed) this is an inherent
 * property of TOTP, not a shortcut. This sits in the same in-memory store as
 * everything else in this codebase today; the honest target architecture
 * (KMS-backed envelope encryption once a real database exists) is documented
 * in `docs/security/key-management-policy.md`. Backup codes ARE hashed
 * (`lib/server/mfa.ts#hashBackupCode`) since, unlike the TOTP secret, they're
 * never recomputed — only compared.
 */

export interface MfaRecord {
  userId: string;
  enabled: boolean;
  secret: string | null;
  pendingSecret: string | null;
  pendingBackupCodeHashes: string[];
  backupCodeHashes: string[];
  enrolledAt: string | null;
}

function emptyRecord(userId: string): MfaRecord {
  return {
    userId,
    enabled: false,
    secret: null,
    pendingSecret: null,
    pendingBackupCodeHashes: [],
    backupCodeHashes: [],
    enrolledAt: null,
  };
}

class MfaStore {
  private recordsByUserId = new Map<string, MfaRecord>();

  get(userId: string): MfaRecord {
    return this.recordsByUserId.get(userId) ?? emptyRecord(userId);
  }

  isEnabled(userId: string): boolean {
    return this.recordsByUserId.get(userId)?.enabled ?? false;
  }

  setPendingSecret(userId: string, secret: string, backupCodeHashes: string[]): void {
    const record = { ...this.get(userId), pendingSecret: secret, pendingBackupCodeHashes: backupCodeHashes };
    this.recordsByUserId.set(userId, record);
  }

  /** Promotes `pendingSecret`/`pendingBackupCodeHashes` to active, enables MFA. */
  confirmEnrollment(userId: string): MfaRecord {
    const current = this.get(userId);
    if (!current.pendingSecret) {
      throw new Error('No pending MFA enrollment for this user.');
    }
    const record: MfaRecord = {
      userId,
      enabled: true,
      secret: current.pendingSecret,
      pendingSecret: null,
      pendingBackupCodeHashes: [],
      backupCodeHashes: current.pendingBackupCodeHashes,
      enrolledAt: new Date().toISOString(),
    };
    this.recordsByUserId.set(userId, record);
    return record;
  }

  disable(userId: string): void {
    this.recordsByUserId.set(userId, emptyRecord(userId));
  }

  replaceBackupCodeHashes(userId: string, hashes: string[]): void {
    const record = { ...this.get(userId), backupCodeHashes: hashes };
    this.recordsByUserId.set(userId, record);
  }

  consumeBackupCode(userId: string, remainingHashes: string[]): void {
    const record = { ...this.get(userId), backupCodeHashes: remainingHashes };
    this.recordsByUserId.set(userId, record);
  }
}

const globalForMfa = globalThis as unknown as { mfaStore?: MfaStore };
export const mfaStore = globalForMfa.mfaStore ?? new MfaStore();
if (process.env.NODE_ENV !== 'production') globalForMfa.mfaStore = mfaStore;
