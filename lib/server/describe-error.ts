/**
 * Turns a thrown value into a string that actually says something.
 *
 * ## Why this exists
 *
 * The usual `err instanceof Error ? err.message : String(err)` produces an
 * **empty string** for the most common infrastructure failure there is. When
 * Node cannot reach a host it throws an `AggregateError` — one entry per
 * address the happy-eyeballs resolver tried — and `AggregateError.message` is
 * `''`. So a Postgres outage logged as:
 *
 *     [realtime-repo] saveTrade DB write failed, using in-memory store {"error":""}
 *
 * repeated 1196 times, saying nothing. The database was down because Docker
 * had stopped, and every log line that should have said `ECONNREFUSED` said
 * nothing at all. The same blindness hid the Redis failure in the same run.
 *
 * This prefers, in order: a non-empty `message`, the `code` (`ECONNREFUSED`,
 * `ETIMEDOUT`, a Postgres SQLSTATE), the first meaningful nested error from an
 * `AggregateError`, and finally the constructor name — so the output is never
 * empty when something genuinely failed.
 */
export function describeError(err: unknown): string {
  if (typeof err === 'string') return err || 'unknown error';
  if (!(err instanceof Error)) return String(err ?? 'unknown error');

  const code = (err as { code?: unknown }).code;
  const codeText = typeof code === 'string' && code.length > 0 ? code : null;

  if (err.message) {
    return codeText && !err.message.includes(codeText) ? `${err.message} (${codeText})` : err.message;
  }

  if (codeText) return codeText;

  // AggregateError from a failed connection: every address that was tried.
  const nested = (err as { errors?: unknown }).errors;
  if (Array.isArray(nested) && nested.length > 0) {
    const described = nested
      .map((inner) => describeError(inner))
      .filter((text) => text && text !== 'unknown error');
    const unique = [...new Set(described)];
    if (unique.length > 0) return `${err.name}: ${unique.join(', ')}`;
  }

  return err.name || 'unknown error';
}
