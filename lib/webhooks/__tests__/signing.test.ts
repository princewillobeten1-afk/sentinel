import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature, buildSignedHeaders, buildSignedContent, generateWebhookSecret } from '../signing';

const SECRET = 'whsec_test_secret_value';
const EVENT_ID = 'evt_abc123';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const BODY = JSON.stringify({ hello: 'world' });

describe('webhook signing', () => {
  it('sign → verify round-trips successfully', () => {
    const signature = signPayload(SECRET, TIMESTAMP, EVENT_ID, BODY);
    expect(verifySignature(SECRET, TIMESTAMP, EVENT_ID, BODY, signature)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const signature = signPayload(SECRET, TIMESTAMP, EVENT_ID, BODY);
    expect(verifySignature(SECRET, TIMESTAMP, EVENT_ID, '{"hello":"tampered"}', signature)).toBe(false);
  });

  it('rejects a tampered timestamp (blocks replay with a fresh clock)', () => {
    const signature = signPayload(SECRET, TIMESTAMP, EVENT_ID, BODY);
    expect(verifySignature(SECRET, '2026-06-01T00:00:00.000Z', EVENT_ID, BODY, signature)).toBe(false);
  });

  it('rejects a tampered eventId (blocks replaying one event as another)', () => {
    const signature = signPayload(SECRET, TIMESTAMP, EVENT_ID, BODY);
    expect(verifySignature(SECRET, TIMESTAMP, 'evt_different', BODY, signature)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const signature = signPayload('whsec_other_secret', TIMESTAMP, EVENT_ID, BODY);
    expect(verifySignature(SECRET, TIMESTAMP, EVENT_ID, BODY, signature)).toBe(false);
  });

  it('returns false rather than throwing on malformed signature input', () => {
    expect(verifySignature(SECRET, TIMESTAMP, EVENT_ID, BODY, 'not-hex-at-all!!')).toBe(false);
    expect(verifySignature(SECRET, TIMESTAMP, EVENT_ID, BODY, '')).toBe(false);
  });

  it('buildSignedHeaders emits all three required headers with a verifiable signature', () => {
    const headers = buildSignedHeaders(SECRET, EVENT_ID, BODY, TIMESTAMP);
    expect(headers['X-Sentinel-Timestamp']).toBe(TIMESTAMP);
    expect(headers['X-Sentinel-Event-Id']).toBe(EVENT_ID);
    expect(
      verifySignature(SECRET, headers['X-Sentinel-Timestamp'], headers['X-Sentinel-Event-Id'], BODY, headers['X-Sentinel-Signature']),
    ).toBe(true);
  });

  it('buildSignedContent is the documented timestamp.eventId.body shape receivers must reconstruct', () => {
    expect(buildSignedContent('T', 'E', 'B')).toBe('T.E.B');
  });

  it('generateWebhookSecret produces a prefixed, unique secret', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.startsWith('whsec_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
