import { afterEach, expect, it, vi } from 'vitest';
import { googleAuthorizationUrl, googleOAuthConfig, newGoogleFlow, readGoogleFlow, safeReturnTo, sealGoogleFlow } from '../google-oauth';

const secret = 'test-signing-secret-that-is-not-a-real-credential';

afterEach(() => vi.unstubAllEnvs());

it('requires the configured Google redirect URI to match the API callback route', () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('AUTH_JWT_SECRET', secret);
  vi.stubEnv('DATABASE_URL', 'postgres://not-used-in-this-test');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://sentinel.example/api/v1/auth/google/callback');
  expect(googleOAuthConfig().redirectUri).toBe('https://sentinel.example/api/v1/auth/google/callback');

  vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://sentinel.example/auth/google/callback');
  expect(() => googleOAuthConfig()).toThrow();
});

it('round-trips a short-lived signed state and binds it to the callback state', () => {
  const flow = newGoogleFlow('/ai?panel=copilot');
  const sealed = sealGoogleFlow(flow, secret);
  expect(readGoogleFlow(sealed, flow.state, secret)).toMatchObject({ returnTo: '/ai?panel=copilot' });
  expect(() => readGoogleFlow(sealed, 'wrong', secret)).toThrow();
  expect(() => readGoogleFlow(sealed + 'x', flow.state, secret)).toThrow();
  expect(() => readGoogleFlow(sealGoogleFlow({ ...flow, createdAt: Date.now() - 601_000 }, secret), flow.state, secret)).toThrow();
});

it('rejects external return paths and requests only identity scopes with PKCE', () => {
  expect(safeReturnTo('//evil.example')).toBe('/ai');
  expect(safeReturnTo('/\\evil.example')).toBe('/ai');
  const flow = newGoogleFlow('/ai');
  const url = new URL(googleAuthorizationUrl(flow, {
    clientId: 'client-id', clientSecret: 'test-secret', redirectUri: 'http://localhost:3000/api/v1/auth/google/callback', signingSecret: secret,
  }));
  expect(url.host).toBe('accounts.google.com');
  expect(url.searchParams.get('scope')).toBe('openid email profile');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toBe(flow.state);
  expect(url.searchParams.has('client_secret')).toBe(false);
});
