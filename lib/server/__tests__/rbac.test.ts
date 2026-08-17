import { describe, expect, it } from 'vitest';
import { requireRole } from '../rbac';
import { ApiError } from '../errors';

describe('requireRole', () => {
  it('allows a user whose role is in the allowed list', () => {
    expect(() => requireRole({ userId: 'u1', role: 'admin' }, ['admin'])).not.toThrow();
  });

  it('allows when multiple roles are permitted and the user has one of them', () => {
    expect(() => requireRole({ userId: 'u1', role: 'analyst' }, ['admin', 'analyst'])).not.toThrow();
  });

  it('throws a 403 ApiError when the role is not allowed', () => {
    try {
      requireRole({ userId: 'u1', role: 'user' }, ['admin']);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(403);
      expect((err as ApiError).code).toBe('ROLE_FORBIDDEN');
    }
  });
});
