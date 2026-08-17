import { describe, expect, it } from 'vitest';
import { assertSameOriginForCookieAuth, originMatchesHost } from '../csrf';
import { ApiError } from '../errors';

describe('originMatchesHost', () => {
  it('returns true when Origin host matches', () => {
    expect(originMatchesHost('https://sentinel.app', null, 'sentinel.app')).toBe(true);
  });

  it('returns false when Origin host mismatches', () => {
    expect(originMatchesHost('https://evil.example', null, 'sentinel.app')).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(originMatchesHost(null, 'https://sentinel.app/some/path', 'sentinel.app')).toBe(true);
  });

  it('returns false when both Origin and Referer are absent', () => {
    expect(originMatchesHost(null, null, 'sentinel.app')).toBe(false);
  });

  it('returns false for an unparseable Origin', () => {
    expect(originMatchesHost('not a url', null, 'sentinel.app')).toBe(false);
  });
});

function buildRequest(headers: Record<string, string>): Request {
  return new Request('http://internal-test/', { headers });
}

describe('assertSameOriginForCookieAuth', () => {
  it('does not throw for GET/HEAD/OPTIONS regardless of Origin', () => {
    const request = buildRequest({ host: 'sentinel.app' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'GET' })).not.toThrow();
    expect(() => assertSameOriginForCookieAuth(request, { method: 'HEAD' })).not.toThrow();
    expect(() => assertSameOriginForCookieAuth(request, { method: 'OPTIONS' })).not.toThrow();
  });

  it('allows a POST with a matching Origin', () => {
    const request = buildRequest({ host: 'sentinel.app', origin: 'https://sentinel.app' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'POST' })).not.toThrow();
  });

  it('allows a matching Origin with a different scheme/port as long as host matches (Host header has no scheme)', () => {
    const request = buildRequest({ host: 'localhost:3911', origin: 'http://localhost:3911' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'POST' })).not.toThrow();
  });

  it('rejects a POST with a mismatched Origin', () => {
    const request = buildRequest({ host: 'sentinel.app', origin: 'https://evil.example' });
    try {
      assertSameOriginForCookieAuth(request, { method: 'POST' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).statusCode).toBe(403);
      expect((err as ApiError).code).toBe('CSRF_ORIGIN_MISMATCH');
    }
  });

  it('rejects a POST with no Origin and no Referer', () => {
    const request = buildRequest({ host: 'sentinel.app' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'POST' })).toThrow(ApiError);
  });

  it('falls back to a matching Referer when Origin is absent', () => {
    const request = buildRequest({ host: 'sentinel.app', referer: 'https://sentinel.app/trade/solana/SENT' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'DELETE' })).not.toThrow();
  });

  it('rejects a mismatched Referer when Origin is absent', () => {
    const request = buildRequest({ host: 'sentinel.app', referer: 'https://evil.example/phish' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'DELETE' })).toThrow(ApiError);
  });

  it('rejects when the Host header itself is missing', () => {
    const request = buildRequest({ origin: 'https://sentinel.app' });
    expect(() => assertSameOriginForCookieAuth(request, { method: 'PUT' })).toThrow(ApiError);
  });
});
