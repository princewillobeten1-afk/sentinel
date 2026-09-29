import { expect, it } from 'vitest';
import { authResponseData } from '../client-response';

it('unwraps the account API response envelope', () => {
  const data = authResponseData<{ user: { id: string } }>({
    success: true, data: { user: { id: 'user-1' } },
  });
  expect(data.user.id).toBe('user-1');
});

it('rejects malformed or unwrapped account responses', () => {
  expect(() => authResponseData({ success: true, user: { id: 'user-1' } })).toThrow();
  expect(() => authResponseData({ success: false, data: { user: { id: 'user-1' } } })).toThrow();
  expect(() => authResponseData(null)).toThrow();
});
