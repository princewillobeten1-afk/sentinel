import { ApiError } from '@/lib/server/errors';

export interface CursorPayload {
  offset: number;
  filterFingerprint: string;
}

/**
 * Cursor Pagination (Sprint 31 — Item 3)
 *
 * Opaque, base64url-encoded `{offset, filterFingerprint}`. Additive: routes
 * that never send a `cursor` are completely unaffected — `resolveOffset`
 * falls straight back to the raw `offset` query param. `filterFingerprint`
 * binds a cursor to the exact query (section/sort/chain/filters — everything
 * except offset/limit/cursor itself) it was minted for, so a cursor can't be
 * replayed against a different filter and silently return the wrong page.
 * An invalid or mismatched cursor fails loud with a 400, not a silent
 * fallback to offset 0.
 */

/** FNV-1a, 32-bit. Deterministic and dependency-free — no `node:crypto`
 * import needed, which keeps this module safely importable from any route
 * file regardless of its `server-only` status. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Deterministic fingerprint of the fields that define "which query is this
 * page part of" — order-independent and ignores `undefined` values so
 * equivalent queries always fingerprint identically.
 */
export function computeFilterFingerprint(fields: Record<string, unknown>): string {
  const keys = Object.keys(fields)
    .filter((key) => fields[key] !== undefined)
    .sort();
  const normalized = JSON.stringify(keys.map((key) => [key, fields[key]]));
  return fnv1a(normalized);
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (typeof parsed.offset !== 'number' || typeof parsed.filterFingerprint !== 'string') {
      return null;
    }
    return { offset: parsed.offset, filterFingerprint: parsed.filterFingerprint };
  } catch {
    return null;
  }
}

/**
 * Resolves the effective offset for a request: a cursor minted for this
 * exact filter takes precedence over the raw `offset` param. Throws a 400
 * `ApiError` on a missing/tampered/filter-mismatched cursor.
 */
export function resolveOffset(rawOffset: number, cursor: string | undefined, filterFingerprint: string): number {
  if (cursor === undefined) return rawOffset;

  const decoded = decodeCursor(cursor);
  if (!decoded || decoded.filterFingerprint !== filterFingerprint) {
    throw new ApiError('Invalid or expired cursor for this query', 400, 'INVALID_CURSOR');
  }
  return decoded.offset;
}

/**
 * Cursor for the next page, or null once there's nothing left to paginate
 * into. `hasMoreHint` lets callers with a real total (e.g. Birdeye's own
 * response metadata, or an in-process `sorted.length`) be precise; otherwise
 * this falls back to the standard "a full page might mean there's more"
 * heuristic.
 */
export function nextCursorFor(
  offset: number,
  limit: number,
  returnedCount: number,
  filterFingerprint: string,
  hasMoreHint?: boolean,
): string | null {
  const hasMore = hasMoreHint ?? returnedCount === limit;
  if (!hasMore) return null;
  return encodeCursor({ offset: offset + returnedCount, filterFingerprint });
}
