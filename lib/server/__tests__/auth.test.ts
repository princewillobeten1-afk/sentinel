import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `env.AUTH_JWT_SECRET` and the dev-secret fallback in `lib/server/auth.ts` are both
 * captured once per module instance, so each scenario below resets the module registry
 * and re-imports fresh with `vi.stubEnv` set beforehand — the standard Vitest pattern for
 * testing env-dependent modules.
 */

describe('getJwtSecret via createAuthToken/verifyAuthToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws when AUTH_JWT_SECRET is unset in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', '');
    const { createAuthToken } = await import('../auth');

    expect(() => createAuthToken({ userId: 'user_001', role: 'user' }, 'sid_test')).toThrow(
      /AUTH_JWT_SECRET must be set in production/,
    );
  });

  it('does not throw when AUTH_JWT_SECRET is unset outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_JWT_SECRET', '');
    const { createAuthToken } = await import('../auth');

    expect(() => createAuthToken({ userId: 'user_001', role: 'user' }, 'sid_test')).not.toThrow();
  });

  it('uses a stable per-process dev secret so tokens created and verified in the same process round-trip', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_JWT_SECRET', '');
    const { createAuthToken, verifyAuthToken } = await import('../auth');

    const token = createAuthToken({ userId: 'user_001', role: 'user' }, 'sid_test');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    // Tamper with the signature — a token signed with a different secret must not verify.
    const tampered = `${parts[0]}.${parts[1]}.deadbeef`;
    const result = await verifyAuthToken(tampered);
    expect(result).toBeNull();
  });

  it('respects an explicitly configured AUTH_JWT_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', 'a-real-configured-secret-value');
    const { createAuthToken } = await import('../auth');

    expect(() => createAuthToken({ userId: 'user_001', role: 'user' }, 'sid_test')).not.toThrow();
  });
});

describe('demo-token bypass gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects the demo-token bypass in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', 'a-real-configured-secret-value');
    const { verifyAuthToken } = await import('../auth');

    const result = await verifyAuthToken('demo-token');
    expect(result).toBeNull();
  });

  it('accepts the demo-token bypass outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { verifyAuthToken } = await import('../auth');

    const result = await verifyAuthToken('demo-token');
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user_001');
  });

  it('rejects a malformed non-JWT, non-demo-token string regardless of environment', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { verifyAuthToken } = await import('../auth');

    const result = await verifyAuthToken('not-a-real-token');
    expect(result).toBeNull();
  });
});

describe('session-backed revocation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('verifies a token created via createAuthSession', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { createAuthSession, verifyAuthToken } = await import('../auth');

    const { token } = await createAuthSession({ userId: 'user_001', role: 'user' }, { ip: '1.2.3.4', userAgent: 'test' });
    const result = await verifyAuthToken(token);
    expect(result?.userId).toBe('user_001');
  });

  it('rejects a token whose session has been revoked', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { createAuthSession, verifyAuthToken } = await import('../auth');
    const { sessionStore } = await import('../session-store');

    const { token, session } = await createAuthSession({ userId: 'user_001', role: 'user' }, { ip: null, userAgent: null });
    expect(await verifyAuthToken(token)).not.toBeNull();

    await sessionStore.revoke(session.id, 'test_revoke');
    expect(await verifyAuthToken(token)).toBeNull();
  });

  it('rejects a well-signed token whose sid was never registered as a session', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { createAuthToken, verifyAuthToken } = await import('../auth');

    const token = createAuthToken({ userId: 'user_001', role: 'user' }, 'sid_never_created');
    expect(await verifyAuthToken(token)).toBeNull();
  });
});
