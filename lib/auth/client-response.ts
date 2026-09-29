/** Unwraps the standard API envelope used by the account routes. */
export function authResponseData<T>(body: unknown): T {
  if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true ||
      !('data' in body) || !body.data || typeof body.data !== 'object') {
    throw new Error('Invalid account response');
  }
  return body.data as T;
}
