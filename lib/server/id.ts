import crypto from 'node:crypto';

/**
 * Shared ID generator for anything that needs a short, URL-safe, unguessable
 * identifier with a readable prefix (request IDs, API key IDs, webhook
 * delivery IDs, idempotency records, ...). Not a UUID — deliberately shorter
 * and prefixed so IDs are recognizable in logs at a glance.
 */
export function generateId(prefix: string, bytes = 16): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`;
}
