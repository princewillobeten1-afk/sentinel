import { beforeEach, expect, it } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { authService } from '@/lib/auth/auth-service';
import { verifyAuthToken } from '@/lib/server/auth';
import { sessionStore } from '@/lib/server/session-store';

beforeEach(() => dbRepository.reset());

it('issues a token backed by the same revocable server session', async () => {
  const result = await authService.register({ email: 'session-check@example.com', password: 'test-password-123' });
  expect((await verifyAuthToken(result.token))?.userId).toBe(result.user.id);
  await sessionStore.revoke(result.session.id, 'test');
  expect(await verifyAuthToken(result.token)).toBeNull();
});
