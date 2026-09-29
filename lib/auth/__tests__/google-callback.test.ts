import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), resolve: vi.fn(), createSession: vi.fn() }));
vi.mock('@/lib/auth/google-oauth', async importOriginal => ({
  ...await importOriginal<typeof import('../google-oauth')>(), verifyGoogleCode: mocks.verify,
}));
vi.mock('@/lib/auth/google-account', () => ({ resolveGoogleAccount: mocks.resolve }));
vi.mock('@/lib/server/auth', () => ({ createAuthSession: mocks.createSession, requireAuth: vi.fn() }));
vi.mock('@/lib/server/mfa-store', () => ({ mfaStore: { isEnabled: vi.fn().mockReturnValue(false) } }));

import { GET } from '@/app/api/v1/auth/google/callback/route';
import { newGoogleFlow, sealGoogleFlow } from '../google-oauth';

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/v1/auth/google/callback');
  vi.stubEnv('AUTH_JWT_SECRET', 'test-signing-secret');
  vi.stubEnv('DATABASE_URL', 'postgres://not-used-in-this-test');
  mocks.verify.mockResolvedValue({ subject: 'google-sub', email: 'trader@example.com', name: 'Trader', picture: null });
  mocks.resolve.mockResolvedValue({ userId: 'user-1', email: 'trader@example.com', role: 'user', status: 'active' });
  mocks.createSession.mockResolvedValue({ token: 'signed-session-token' });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it('sets the Sentinel session only after a valid state and verified Google identity', async () => {
  const flow = newGoogleFlow('/ai');
  const sealed = sealGoogleFlow(flow, 'test-signing-secret');
  const request = new Request(`http://localhost:3000/api/v1/auth/google/callback?state=${flow.state}&code=authorization-code`, {
    headers: { Cookie: `sentinel_google_oauth=${encodeURIComponent(sealed)}` },
  });
  const response = await GET(request);
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://localhost:3000/ai');
  expect(response.headers.get('set-cookie')).toContain('sentinel_session=');
  expect(mocks.verify).toHaveBeenCalledWith('authorization-code', expect.objectContaining({ nonce: flow.nonce }), expect.anything());
  expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), expect.anything());
});
