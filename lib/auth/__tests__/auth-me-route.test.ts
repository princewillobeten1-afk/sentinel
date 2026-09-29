import { expect, it, vi } from 'vitest';

vi.mock('@/lib/server/auth', () => ({ requireAuth: vi.fn().mockResolvedValue({ userId: 'user-1' }) }));
vi.mock('@/lib/db/repository', () => ({ dbRepository: { getUser: vi.fn().mockReturnValue({
  id: 'user-1', display_name: 'Trader', email: 'trader@example.com', role: 'user', status: 'active',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
}) } }));
vi.mock('@/lib/server/store', () => ({ serverStore: {
  findUserById: vi.fn(), getUserPreferences: vi.fn().mockResolvedValue({}),
} }));
vi.mock('@/lib/auth/wallet-service', () => ({ walletService: { getUserWallets: vi.fn().mockResolvedValue([]) } }));

import { GET } from '@/app/api/v1/auth/me/route';

it('returns a profile identity usable by the Copilot account state', async () => {
  const response = await GET(new Request('http://localhost/api/v1/auth/me'));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.data.user).toMatchObject({
    id: 'user-1', userId: 'user-1', updatedAt: '2026-01-02T00:00:00.000Z',
  });
});
