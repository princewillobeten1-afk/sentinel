import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/v1/auth/google/route';
import { GET as callback } from '@/app/api/v1/auth/google/callback/route';
import { readGoogleFlow } from '../google-oauth';

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/v1/auth/google/callback');
  vi.stubEnv('AUTH_JWT_SECRET', 'test-signing-secret');
  vi.stubEnv('DATABASE_URL', 'postgres://not-used-in-this-test');
});
afterEach(() => vi.unstubAllEnvs());

it('starts server-side Google OAuth with a signed, short-lived state cookie', async () => {
  const response = await GET(new Request('http://localhost:3000/api/v1/auth/google?returnTo=%2Fai'));
  expect(response.status).toBe(302);
  const destination = new URL(response.headers.get('location')!);
  expect(destination.host).toBe('accounts.google.com');
  const cookie = response.headers.get('set-cookie')!;
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');
  const sealed = decodeURIComponent(cookie.match(/^sentinel_google_oauth=([^;]+)/)![1]);
  expect(readGoogleFlow(sealed, destination.searchParams.get('state'), 'test-signing-secret').returnTo).toBe('/ai');
});

it('fails closed when OAuth credentials are absent', async () => {
  vi.stubEnv('GOOGLE_CLIENT_ID', '');
  const response = await GET(new Request('http://localhost:3000/api/v1/auth/google'));
  expect(response.status).toBe(303);
  expect(new URL(response.headers.get('location')!).searchParams.get('google_error')).toBe('GOOGLE_AUTH_NOT_CONFIGURED');
});

it('rejects a callback without the signed state before exchanging a code', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  try {
    const response = await callback(new Request('http://localhost:3000/api/v1/auth/google/callback?state=forged&code=forged'));
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location')!).searchParams.get('google_error')).toBe('GOOGLE_STATE_INVALID');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
