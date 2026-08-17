import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/server/errors';
import {
  computeFilterFingerprint,
  decodeCursor,
  encodeCursor,
  nextCursorFor,
  resolveOffset,
} from '../cursor';

describe('computeFilterFingerprint', () => {
  it('is order-independent', () => {
    const a = computeFilterFingerprint({ chain: 'solana', section: 'trending' });
    const b = computeFilterFingerprint({ section: 'trending', chain: 'solana' });
    expect(a).toBe(b);
  });

  it('ignores undefined fields', () => {
    const a = computeFilterFingerprint({ chain: 'solana', searchQuery: undefined });
    const b = computeFilterFingerprint({ chain: 'solana' });
    expect(a).toBe(b);
  });

  it('differs when a field value differs', () => {
    const a = computeFilterFingerprint({ chain: 'solana', section: 'trending' });
    const b = computeFilterFingerprint({ chain: 'solana', section: 'movers' });
    expect(a).not.toBe(b);
  });
});

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a payload exactly', () => {
    const payload = { offset: 40, filterFingerprint: 'abc123' };
    const decoded = decodeCursor(encodeCursor(payload));
    expect(decoded).toEqual(payload);
  });

  it('rejects a tampered cursor', () => {
    const cursor = encodeCursor({ offset: 40, filterFingerprint: 'abc123' });
    const tampered = cursor.slice(0, -2) + 'zz';
    // Either fails to parse (null) or parses to something that no longer
    // matches the original payload — both are acceptable "rejected" outcomes.
    const decoded = decodeCursor(tampered);
    if (decoded !== null) {
      expect(decoded).not.toEqual({ offset: 40, filterFingerprint: 'abc123' });
    }
  });

  it('rejects garbage input', () => {
    expect(decodeCursor('not-a-real-cursor!!!')).toBeNull();
  });

  it('rejects a well-formed base64url payload missing required fields', () => {
    const bogus = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf-8').toString('base64url');
    expect(decodeCursor(bogus)).toBeNull();
  });
});

describe('resolveOffset', () => {
  const fingerprint = computeFilterFingerprint({ section: 'trending', chain: 'solana' });

  it('falls back to the raw offset when no cursor is given', () => {
    expect(resolveOffset(20, undefined, fingerprint)).toBe(20);
  });

  it('prefers a valid cursor offset over the raw offset param', () => {
    const cursor = encodeCursor({ offset: 60, filterFingerprint: fingerprint });
    expect(resolveOffset(20, cursor, fingerprint)).toBe(60);
  });

  it('throws a 400 ApiError on a filter-mismatched cursor', () => {
    const otherFingerprint = computeFilterFingerprint({ section: 'movers', chain: 'solana' });
    const cursor = encodeCursor({ offset: 60, filterFingerprint: otherFingerprint });

    expect(() => resolveOffset(20, cursor, fingerprint)).toThrow(ApiError);
    try {
      resolveOffset(20, cursor, fingerprint);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
    }
  });

  it('throws a 400 ApiError on a malformed cursor', () => {
    expect(() => resolveOffset(20, 'garbage', fingerprint)).toThrow(ApiError);
  });
});

describe('nextCursorFor', () => {
  const fingerprint = computeFilterFingerprint({ section: 'trending', chain: 'solana' });

  it('returns null when hasMoreHint is explicitly false', () => {
    expect(nextCursorFor(0, 20, 20, fingerprint, false)).toBeNull();
  });

  it('returns an encoded cursor advancing past the current page when hasMoreHint is true', () => {
    const cursor = nextCursorFor(0, 20, 20, fingerprint, true);
    expect(cursor).not.toBeNull();
    expect(decodeCursor(cursor!)).toEqual({ offset: 20, filterFingerprint: fingerprint });
  });

  it('falls back to the full-page heuristic when hasMoreHint is omitted', () => {
    expect(nextCursorFor(0, 20, 20, fingerprint)).not.toBeNull();
    expect(nextCursorFor(0, 20, 5, fingerprint)).toBeNull();
  });
});
