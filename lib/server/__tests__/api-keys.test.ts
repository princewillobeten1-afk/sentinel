import { describe, it, expect } from 'vitest';
import { apiKeyStore } from '../api-keys';
import { ScopeGrantError } from '../scopes';

describe('apiKeyStore', () => {
  it('creates a key, returning the plaintext secret and a display-safe prefix', () => {
    const { key, secret } = apiKeyStore.create('user_test_1', {
      name: 'Test key',
      scopes: ['READ_MARKET_DATA'],
      environment: 'production',
    });

    expect(secret.startsWith('sk_live_')).toBe(true);
    expect(key.keyPrefix.startsWith('sk_live_')).toBe(true);
    expect(secret).not.toBe(key.keyPrefix);
    expect(key.status).toBe('active');
    expect(key.tier).toBe('FREE');
    // Never expose the hash/secret on the public key object.
    expect((key as unknown as Record<string, unknown>).secretHash).toBeUndefined();
  });

  it('generates a sandbox-prefixed secret for sandbox keys', () => {
    const { secret } = apiKeyStore.create('user_test_1', { name: 'Sandbox', scopes: [], environment: 'sandbox' });
    expect(secret.startsWith('sk_sandbox_')).toBe(true);
  });

  it('refuses to create a key with an ungrantable scope combination', () => {
    expect(() =>
      apiKeyStore.create('user_test_1', { name: 'Bad', scopes: ['MANAGE_LAUNCH'], environment: 'production' }),
    ).toThrow(ScopeGrantError);
  });

  it('verifies a freshly created secret and returns the matching key', () => {
    const { key, secret } = apiKeyStore.create('user_test_2', {
      name: 'Verify me',
      scopes: ['TRADE'],
      environment: 'production',
    });

    const verified = apiKeyStore.verify(secret);
    expect(verified?.id).toBe(key.id);
    expect(verified?.scopes).toEqual(['TRADE']);
  });

  it('rejects an unknown secret', () => {
    expect(apiKeyStore.verify('sk_live_totally-made-up')).toBeNull();
  });

  it('rejects a revoked key and clears it from the verify index', () => {
    const { key, secret } = apiKeyStore.create('user_test_3', { name: 'Revoke me', scopes: [], environment: 'production' });
    expect(apiKeyStore.verify(secret)).not.toBeNull();

    const revoked = apiKeyStore.revoke(key.id, 'user_test_3');
    expect(revoked).toBe(true);
    expect(apiKeyStore.verify(secret)).toBeNull();
  });

  it('rotate invalidates the old secret and mints a new one under the same id', () => {
    const { key, secret: originalSecret } = apiKeyStore.create('user_test_4', {
      name: 'Rotate me',
      scopes: ['READ_PORTFOLIO'],
      environment: 'production',
    });

    const rotated = apiKeyStore.rotate(key.id, 'user_test_4');
    expect(rotated).not.toBeNull();
    expect(rotated!.key.id).toBe(key.id);
    expect(rotated!.secret).not.toBe(originalSecret);

    expect(apiKeyStore.verify(originalSecret)).toBeNull();
    expect(apiKeyStore.verify(rotated!.secret)?.id).toBe(key.id);
  });

  it('scopes listForUser/getForUser strictly to the owning user', () => {
    const a = apiKeyStore.create('user_owner', { name: 'Mine', scopes: [], environment: 'production' });
    apiKeyStore.create('user_other', { name: 'Not mine', scopes: [], environment: 'production' });

    const list = apiKeyStore.listForUser('user_owner');
    expect(list.some((k) => k.id === a.key.id)).toBe(true);
    expect(list.every((k) => k.id !== undefined)).toBe(true);

    expect(apiKeyStore.getForUser(a.key.id, 'user_other')).toBeNull();
    expect(apiKeyStore.getForUser(a.key.id, 'user_owner')?.id).toBe(a.key.id);
  });

  it('rotate and revoke refuse to act on a key belonging to a different user', () => {
    const { key } = apiKeyStore.create('user_owner_2', { name: 'Mine', scopes: [], environment: 'production' });
    expect(apiKeyStore.rotate(key.id, 'someone_else')).toBeNull();
    expect(apiKeyStore.revoke(key.id, 'someone_else')).toBe(false);
  });

  it('an already-revoked key cannot be revoked again', () => {
    const { key } = apiKeyStore.create('user_test_5', { name: 'Double revoke', scopes: [], environment: 'production' });
    expect(apiKeyStore.revoke(key.id, 'user_test_5')).toBe(true);
    expect(apiKeyStore.revoke(key.id, 'user_test_5')).toBe(false);
  });
});
