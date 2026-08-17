/**
 * API Key model & lifecycle (Sprint 28 §7, §9).
 *
 * In-memory store, `globalThis`-guarded so it survives Next.js dev-mode HMR
 * without leaking duplicate state — the same pattern `lib/server/store.ts`
 * already uses. `db/migrations/010_api_platform.sql` defines the durable
 * schema this is standing in for; wiring a real driver is a separate task
 * (see `lib/server/database.ts`'s existing TODO).
 *
 * Secrets are hashed with SHA-256, not a slow KDF like bcrypt/scrypt. That's
 * a deliberate, standard choice for API keys (unlike this codebase's actual
 * password-adjacent security elsewhere): the secret itself already has 192
 * bits of entropy from `crypto.randomBytes`, so a slow KDF defends against a
 * threat (low-entropy guessing) that doesn't apply here, while making every
 * request pay KDF latency and preventing an O(1) lookup-by-hash. This is the
 * same approach Stripe/GitHub-style API keys use in practice.
 */

import crypto from 'node:crypto';
import { generateId } from './id';
import { assertScopeGrantable, type Scope } from './scopes';
import type { RateLimitTier } from './rate-limit-v2';

export type ApiKeyEnvironment = 'production' | 'sandbox';
export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  /** Safe to display in a key list — never the full secret. */
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  scopes: Scope[];
  tier: RateLimitTier;
  status: ApiKeyStatus;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

interface StoredApiKey extends ApiKey {
  /** SHA-256 hex digest of the full secret. Never the plaintext. */
  secretHash: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: Scope[];
  environment: ApiKeyEnvironment;
  tier?: RateLimitTier;
  expiresAt?: string | null;
}

export interface CreatedApiKey {
  key: ApiKey;
  /** Shown exactly once, at creation/rotation time. Never retrievable again. */
  secret: string;
}

class ApiKeyStore {
  /** secretHash → key, for O(1) verification lookups. */
  private byHash = new Map<string, StoredApiKey>();
  /** id → key, for CRUD by ID. */
  private byId = new Map<string, StoredApiKey>();

  create(userId: string, input: CreateApiKeyInput): CreatedApiKey {
    assertScopeGrantable(input.scopes);

    const { secret, secretHash, keyPrefix } = mintSecret(input.environment);
    const now = new Date().toISOString();

    const stored: StoredApiKey = {
      id: generateId('key'),
      userId,
      name: input.name,
      keyPrefix,
      secretHash,
      environment: input.environment,
      scopes: [...new Set(input.scopes)],
      tier: input.tier ?? 'FREE',
      status: 'active',
      createdAt: now,
      lastUsedAt: null,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    };

    this.byHash.set(secretHash, stored);
    this.byId.set(stored.id, stored);

    return { key: toPublicKey(stored), secret };
  }

  /**
   * Resolves a presented secret to its key, checking status and expiry.
   * Returns null on any failure — the gateway turns that into a generic
   * 401 rather than distinguishing "not found" from "revoked" from
   * "expired," so a caller probing for valid-but-expired keys learns nothing
   * from the response.
   */
  verify(presentedSecret: string): ApiKey | null {
    const hash = hashSecret(presentedSecret);
    const stored = this.byHash.get(hash);
    if (!stored) return null;

    if (stored.status === 'revoked') return null;

    if (stored.expiresAt && Date.parse(stored.expiresAt) < Date.now()) {
      if (stored.status !== 'expired') {
        stored.status = 'expired';
      }
      return null;
    }

    stored.lastUsedAt = new Date().toISOString();
    return toPublicKey(stored);
  }

  listForUser(userId: string): ApiKey[] {
    return [...this.byId.values()]
      .filter((key) => key.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toPublicKey);
  }

  getForUser(keyId: string, userId: string): ApiKey | null {
    const stored = this.byId.get(keyId);
    if (!stored || stored.userId !== userId) return null;
    return toPublicKey(stored);
  }

  /** Revokes the old secret and mints a fresh one under the same ID/name/scopes/tier. */
  rotate(keyId: string, userId: string): CreatedApiKey | null {
    const stored = this.byId.get(keyId);
    if (!stored || stored.userId !== userId || stored.status !== 'active') return null;

    this.byHash.delete(stored.secretHash);

    const { secret, secretHash, keyPrefix } = mintSecret(stored.environment);
    stored.secretHash = secretHash;
    stored.keyPrefix = keyPrefix;

    this.byHash.set(secretHash, stored);

    return { key: toPublicKey(stored), secret };
  }

  revoke(keyId: string, userId: string): boolean {
    const stored = this.byId.get(keyId);
    if (!stored || stored.userId !== userId || stored.status === 'revoked') return false;

    stored.status = 'revoked';
    stored.revokedAt = new Date().toISOString();
    this.byHash.delete(stored.secretHash);
    return true;
  }
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function mintSecret(environment: ApiKeyEnvironment): { secret: string; secretHash: string; keyPrefix: string } {
  const envTag = environment === 'production' ? 'live' : 'sandbox';
  const random = crypto.randomBytes(24).toString('base64url');
  const secret = `sk_${envTag}_${random}`;
  return {
    secret,
    secretHash: hashSecret(secret),
    keyPrefix: secret.slice(0, secret.indexOf('_', secret.indexOf('_') + 1) + 5),
  };
}

function toPublicKey(stored: StoredApiKey): ApiKey {
  const { secretHash: _secretHash, ...publicKey } = stored;
  return publicKey;
}

// Survives Next.js dev-mode HMR reloads — matches lib/server/store.ts's pattern.
const globalForApiKeys = globalThis as unknown as { apiKeyStore?: ApiKeyStore };
export const apiKeyStore = globalForApiKeys.apiKeyStore ?? new ApiKeyStore();
if (process.env.NODE_ENV !== 'production') globalForApiKeys.apiKeyStore = apiKeyStore;
