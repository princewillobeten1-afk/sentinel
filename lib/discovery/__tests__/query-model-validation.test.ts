import { describe, it, expect } from 'vitest';
import { parseDiscoveryQuery } from '../query-model';
import { ApiError } from '@/lib/server/errors';

const url = (qs: string) => new URL(`https://example.test/api/v1/discovery/migrating${qs}`);

describe('parseDiscoveryQuery — a bad parameter is a 400, not a 500', () => {
  it('rejects an over-large limit as a client error', () => {
    // `?limit=300` used to surface as {"code":"INTERNAL_ERROR"} with a 500,
    // because the routes catch a bare ZodError and wrap it as a server fault.
    try {
      parseDiscoveryQuery(url('?limit=300'));
      expect.unreachable('expected a validation error');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const api = err as ApiError;
      expect(api.statusCode).toBe(400);
      expect(api.code).toBe('INVALID_QUERY');
    }
  });

  it('names the offending field and says what to send instead', () => {
    try {
      parseDiscoveryQuery(url('?limit=300'));
      expect.unreachable('expected a validation error');
    } catch (err) {
      const api = err as ApiError;
      expect(api.message).toContain('limit');
      // Not Zod's default "Invalid input", which is unactionable.
      expect(api.message).not.toContain('Invalid input');
      expect(api.message).toContain('100');
      expect(api.details).toEqual([{ field: 'limit', message: expect.stringContaining('100') }]);
    }
  });

  it('rejects a negative offset', () => {
    try {
      parseDiscoveryQuery(url('?offset=-5'));
      expect.unreachable('expected a validation error');
    } catch (err) {
      const api = err as ApiError;
      expect(api.statusCode).toBe(400);
      expect(api.message).toContain('offset');
    }
  });

  it('accepts a valid query and applies defaults', () => {
    const params = parseDiscoveryQuery(url('?limit=30'));
    expect(params.limit).toBe(30);
    expect(params.offset).toBe(0);
  });

  it('accepts the boundary values rather than rejecting them', () => {
    expect(parseDiscoveryQuery(url('?limit=1')).limit).toBe(1);
    expect(parseDiscoveryQuery(url('?limit=100')).limit).toBe(100);
  });

  it('ignores unknown parameters instead of failing on them', () => {
    // Stripping unknowns is the documented behaviour; a stray tracking param
    // from a link must not 400 the whole column.
    expect(() => parseDiscoveryQuery(url('?limit=30&utm_source=x'))).not.toThrow();
  });
});
