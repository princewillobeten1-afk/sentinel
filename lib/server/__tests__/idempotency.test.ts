import { describe, it, expect, beforeEach } from 'vitest';
import { withIdempotency, fingerprintRequest, resetIdempotencyState } from '../idempotency';
import { ApiError } from '../errors';

describe('idempotency', () => {
  beforeEach(() => {
    resetIdempotencyState();
  });

  it('runs the handler once and returns its result', async () => {
    let calls = 0;
    const result = await withIdempotency('user_1', 'key_1', 'fp_1', async () => {
      calls += 1;
      return { status: 201, body: { id: 'order_1' } };
    });

    expect(calls).toBe(1);
    expect(result.replayed).toBe(false);
    expect(result.body).toEqual({ id: 'order_1' });
  });

  it('replays the cached result for a repeated key + matching fingerprint without re-running the handler', async () => {
    let calls = 0;
    const run = async () => {
      calls += 1;
      return { status: 201, body: { id: `order_${calls}` } };
    };

    const first = await withIdempotency('user_2', 'key_2', 'fp_2', run);
    const second = await withIdempotency('user_2', 'key_2', 'fp_2', run);

    expect(calls).toBe(1);
    expect(first.body).toEqual(second.body);
    expect(second.replayed).toBe(true);
  });

  it('throws 409 IDEMPOTENCY_KEY_CONFLICT when the same key is reused for a different request', async () => {
    await withIdempotency('user_3', 'key_3', 'fp_a', async () => ({ status: 201, body: { id: 'x' } }));

    await expect(
      withIdempotency('user_3', 'key_3', 'fp_b', async () => ({ status: 201, body: { id: 'y' } })),
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' } satisfies Partial<ApiError>);
  });

  it('scopes idempotency keys per user, so two users can reuse the same key independently', async () => {
    const first = await withIdempotency('user_a', 'shared_key', 'fp', async () => ({ status: 200, body: 'a' }));
    const second = await withIdempotency('user_b', 'shared_key', 'fp', async () => ({ status: 200, body: 'b' }));

    expect(first.body).toBe('a');
    expect(second.body).toBe('b');
  });

  it('fingerprintRequest is deterministic for identical inputs and differs for different bodies', () => {
    const a = fingerprintRequest('POST', '/api/v1/orders', { amount: 10 });
    const b = fingerprintRequest('POST', '/api/v1/orders', { amount: 10 });
    const c = fingerprintRequest('POST', '/api/v1/orders', { amount: 20 });

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
