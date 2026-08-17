/**
 * Idempotency-Key support (Sprint 28 §67-68).
 *
 * Write endpoints that opt in (order creation, launch creation, webhook
 * creation, trade submission) can be safely retried by a client after a
 * network timeout without risking a duplicate side effect: the same
 * `Idempotency-Key` replays the cached first response instead of re-running
 * the handler.
 *
 * In-memory, TTL-bounded — consistent with this sprint's persistence
 * decision. A restart loses the dedup window, which only matters for
 * requests retried across a restart, not the common "client retried a few
 * seconds later after a timeout" case this exists for.
 */

import crypto from 'node:crypto';
import { ApiError } from './errors';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface IdempotencyRecord {
  fingerprint: string;
  status: number;
  body: unknown;
  headers: Record<string, string>;
  expiresAt: number;
}

const records = new Map<string, IdempotencyRecord>();

function compositeKey(userId: string, idempotencyKey: string): string {
  return `${userId}:${idempotencyKey}`;
}

/** Deterministic fingerprint of "what was actually requested," so a reused key with a different body is rejected rather than silently replayed. */
export function fingerprintRequest(method: string, path: string, body: unknown): string {
  const payload = JSON.stringify({ method, path, body: body ?? null });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  headers: Record<string, string>;
  /** True when this response was served from cache rather than freshly computed. */
  replayed: boolean;
}

/**
 * Runs `run()` at most once per (user, idempotency key) within the TTL
 * window. A second call with the same key and the same fingerprint replays
 * the first result; the same key with a different fingerprint is a
 * developer error (reusing a key for a different request) and throws
 * `409 IDEMPOTENCY_KEY_CONFLICT` rather than silently doing either request.
 */
export async function withIdempotency<T>(
  userId: string,
  idempotencyKey: string,
  fingerprint: string,
  run: () => Promise<{ status: number; body: T; headers?: Record<string, string> }>,
): Promise<IdempotentResult<T>> {
  const key = compositeKey(userId, idempotencyKey);
  pruneExpired();

  const existing = records.get(key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new ApiError(
        'This Idempotency-Key was already used for a different request.',
        409,
        'IDEMPOTENCY_KEY_CONFLICT',
      );
    }
    return { status: existing.status, body: existing.body as T, headers: existing.headers, replayed: true };
  }

  const result = await run();
  records.set(key, {
    fingerprint,
    status: result.status,
    body: result.body,
    headers: result.headers ?? {},
    expiresAt: Date.now() + DEFAULT_TTL_MS,
  });

  return { ...result, headers: result.headers ?? {}, replayed: false };
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, record] of records) {
    if (record.expiresAt < now) records.delete(key);
  }
}

/** Test-only reset. */
export function resetIdempotencyState(): void {
  records.clear();
}
