/**
 * Webhook payload signing (Sprint 28 §46, §48).
 *
 * Every delivered event carries `timestamp`, `eventId`, and a
 * HMAC-SHA256 `signature` computed over `timestamp.eventId.body`, so a
 * receiver can (a) verify the payload actually came from Sentinel using
 * their webhook secret, and (b) reject replays of an event they've already
 * processed by tracking seen `eventId`s.
 *
 * Pure functions — no I/O — directly unit-testable.
 */

import crypto from 'node:crypto';

export interface SignedHeaders {
  'X-Sentinel-Timestamp': string;
  'X-Sentinel-Event-Id': string;
  'X-Sentinel-Signature': string;
}

/** The exact string that gets HMAC'd — receivers reconstruct this identically to verify. */
export function buildSignedContent(timestamp: string, eventId: string, body: string): string {
  return `${timestamp}.${eventId}.${body}`;
}

export function signPayload(secret: string, timestamp: string, eventId: string, body: string): string {
  const content = buildSignedContent(timestamp, eventId, body);
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

export function buildSignedHeaders(secret: string, eventId: string, body: string, timestamp = new Date().toISOString()): SignedHeaders {
  return {
    'X-Sentinel-Timestamp': timestamp,
    'X-Sentinel-Event-Id': eventId,
    'X-Sentinel-Signature': signPayload(secret, timestamp, eventId, body),
  };
}

/**
 * Verifies a received webhook. Uses a timing-safe comparison so a receiver
 * implementing this can't leak the correct signature byte-by-byte via
 * response-time analysis. Returns false (never throws) on any malformed
 * input — verification failing is an expected, not exceptional, outcome.
 */
export function verifySignature(secret: string, timestamp: string, eventId: string, body: string, signature: string): boolean {
  try {
    const expected = signPayload(secret, timestamp, eventId, body);
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/** Generates a webhook signing secret (shown once, like an API key). */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}
