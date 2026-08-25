import { describe, it, expect } from 'vitest';
import {
  buildGetTransactionBatch,
  mapBatchResults,
  nextBackoff,
  createBatcher,
  type JsonRpcRequest,
} from '../rpc-batch';

describe('buildGetTransactionBatch', () => {
  it('builds one request per signature, id-indexed', () => {
    const body = buildGetTransactionBatch(['sigA', 'sigB']);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(0);
    expect(body[1].id).toBe(1);
    expect(body[0].params[0]).toBe('sigA');
    expect(body[1].params[0]).toBe('sigB');
  });

  it('always sets maxSupportedTransactionVersion', () => {
    // Without it the node refuses every versioned transaction, which on
    // mainnet is most swaps.
    const [req] = buildGetTransactionBatch(['sig']);
    expect((req.params[1] as { maxSupportedTransactionVersion?: number }).maxSupportedTransactionVersion).toBe(0);
  });
});

describe('mapBatchResults', () => {
  it('maps by id rather than by position', () => {
    // Nodes are not obliged to answer in request order.
    const slots = mapBatchResults([{ id: 1, result: 'B' }, { id: 0, result: 'A' }], 2);
    expect(slots).toEqual(['A', 'B']);
  });

  it('returns all-null for a single error object instead of an array', () => {
    // A batch can be rejected wholesale. Reading that as "no trades" would
    // report real signatures as empty.
    expect(mapBatchResults({ error: { code: -32600, message: 'Invalid' } }, 3)).toEqual([null, null, null]);
  });

  it('leaves a slot null when its entry carries an error', () => {
    const slots = mapBatchResults([{ id: 0, error: { message: 'nope' } }, { id: 1, result: 'B' }], 2);
    expect(slots[0]).toBeNull();
    expect(slots[1]).toBe('B');
  });

  it('reads a bare (non-array) response when a single call was sent', () => {
    // Single-call requests go as a bare object and come back as one. Treating
    // that as "not an array, so no results" would report a real transaction as
    // having no trade — and single-call is the default configuration.
    expect(mapBatchResults({ id: 0, result: 'ONLY' }, 1)).toEqual(['ONLY']);
  });

  it('still returns null for a bare error response to a single call', () => {
    expect(mapBatchResults({ id: 0, error: { message: 'nope' } }, 1)).toEqual([null]);
  });

  it('ignores out-of-range and malformed ids', () => {
    const slots = mapBatchResults([{ id: 99, result: 'X' }, { id: 'a', result: 'Y' }, null], 2);
    expect(slots).toEqual([null, null]);
  });
});

describe('nextBackoff', () => {
  it('doubles up to the cap when rate limited', () => {
    expect(nextBackoff(100, true, 100, 1000)).toBe(200);
    expect(nextBackoff(800, true, 100, 1000)).toBe(1000);
  });

  it('decays gradually on success rather than snapping back', () => {
    // Resetting straight to base would re-trigger the limit on the next batch.
    expect(nextBackoff(800, false, 100, 1000)).toBe(400);
    expect(nextBackoff(100, false, 100, 1000)).toBe(100);
  });
});

const okTransport = (results: Record<string, unknown>) =>
  async (body: JsonRpcRequest[]) => ({
    status: 200,
    body: body.map((req) => ({
      id: req.id,
      result: results[req.params[0] as string] ?? null,
    })),
  });

describe('createBatcher', () => {
  it('packs concurrent submits into one request and routes each result back', async () => {
    let calls = 0;
    const batcher = createBatcher<string>({
      transport: async (body) => {
        calls++;
        return okTransport({ a: 'RA', b: 'RB', c: 'RC' })(body);
      },
      decode: (r) => (typeof r === 'string' ? r : null),
      batchSize: 10,
      waitMs: 1,
      minIntervalMs: 0,
      maxConcurrency: 2,
      maxQueue: 100,
    });

    const [a, b, c] = await Promise.all([
      batcher.submit('a'),
      batcher.submit('b'),
      batcher.submit('c'),
    ]);

    expect([a, b, c]).toEqual(['RA', 'RB', 'RC']);
    expect(calls).toBe(1);
  });

  it('flushes immediately once the buffer reaches batchSize', async () => {
    let sizes: number[] = [];
    const batcher = createBatcher<string>({
      transport: async (body) => {
        sizes.push(body.length);
        return okTransport({})(body);
      },
      decode: () => null,
      batchSize: 2,
      waitMs: 10_000, // never fires; only a full buffer can flush
      minIntervalMs: 0,
      maxConcurrency: 2,
      maxQueue: 100,
    });

    await Promise.all([batcher.submit('a'), batcher.submit('b')]);
    expect(sizes).toEqual([2]);
  });

  it('settles every caller when the transport throws', async () => {
    // The leak this guards: a dropped settle leaves helius-client's .then
    // pending forever.
    const batcher = createBatcher<string>({
      transport: async () => {
        throw new Error('socket hang up');
      },
      decode: () => 'never',
      batchSize: 10,
      waitMs: 1,
      minIntervalMs: 0,
      maxConcurrency: 2,
      maxQueue: 100,
    });

    const results = await Promise.all([batcher.submit('a'), batcher.submit('b')]);
    expect(results).toEqual([null, null]);
    expect(batcher.stats().failed).toBe(1);
  });

  it('settles every caller and backs off on a 429', async () => {
    const batcher = createBatcher<string>({
      transport: async () => ({ status: 429, body: 'Too Many Requests' }),
      decode: () => 'never',
      batchSize: 10,
      waitMs: 1,
      minIntervalMs: 100,
      maxConcurrency: 2,
      maxQueue: 100,
      backoffCapMs: 1000,
    });

    const results = await Promise.all([batcher.submit('a'), batcher.submit('b')]);
    expect(results).toEqual([null, null]);
    expect(batcher.stats().rateLimited).toBe(1);
    expect(batcher.stats().currentIntervalMs).toBeGreaterThan(100);
  });

  it('settles every caller on a non-2xx that is not a rate limit', async () => {
    const batcher = createBatcher<string>({
      transport: async () => ({ status: 500, body: null }),
      decode: () => 'never',
      batchSize: 10,
      waitMs: 1,
      minIntervalMs: 0,
      maxConcurrency: 2,
      maxQueue: 100,
    });

    expect(await Promise.all([batcher.submit('a')])).toEqual([null]);
    expect(batcher.stats().failed).toBe(1);
  });

  it('isolates a decode failure to its own slot', async () => {
    const batcher = createBatcher<string>({
      transport: okTransport({ a: 'RA', b: 'BOOM' }),
      decode: (r) => {
        if (r === 'BOOM') throw new Error('bad slot');
        return r as string;
      },
      batchSize: 10,
      waitMs: 1,
      minIntervalMs: 0,
      maxConcurrency: 2,
      maxQueue: 100,
    });

    const [a, b] = await Promise.all([batcher.submit('a'), batcher.submit('b')]);
    expect(a).toBe('RA');
    expect(b).toBeNull();
  });

  it('drops rather than growing without bound when the queue is full', async () => {
    const batcher = createBatcher<string>({
      // Never resolves during the test, so the buffer genuinely fills.
      transport: () => new Promise(() => {}) as Promise<{ status: number; body: unknown }>,
      decode: () => null,
      batchSize: 1000,
      waitMs: 10_000,
      minIntervalMs: 0,
      maxConcurrency: 1,
      maxQueue: 2,
      backoffCapMs: 10,
    });

    void batcher.submit('a');
    void batcher.submit('b');
    // Third submit exceeds maxQueue and resolves null straight away.
    await expect(batcher.submit('c')).resolves.toBeNull();
    expect(batcher.stats().droppedQueueFull).toBe(1);
  });

  it('charges the rate budget per call, not per batch', async () => {
    // The bug this pins: pacing per *request* let a 100-call batch spend 100
    // slots in one slot's time, which Helius answered with 429 on 241 of 243
    // batches. A batch of N must cost N slots.
    const sentAt: number[] = [];
    const batcher = createBatcher<string>({
      transport: async (body) => {
        sentAt.push(Date.now());
        return okTransport({})(body);
      },
      decode: () => null,
      batchSize: 4,
      waitMs: 1,
      minIntervalMs: 25, // 40 calls/sec
      maxConcurrency: 1,
      maxQueue: 100,
    });

    const t0 = Date.now();
    await Promise.all(['a', 'b', 'c', 'd'].map((s) => batcher.submit(s)));
    await Promise.all(['e', 'f', 'g', 'h'].map((s) => batcher.submit(s)));

    expect(sentAt).toHaveLength(2);
    // Four calls at 25ms each = 100ms of budget before the second batch may go.
    expect(sentAt[1] - t0).toBeGreaterThanOrEqual(90);
  });

  it('processes signatures that arrive while a batch is in flight', async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => { release = r; });
    let call = 0;

    const batcher = createBatcher<string>({
      transport: async (body) => {
        call++;
        if (call === 1) await gate;
        return okTransport({ a: 'RA', b: 'RB' })(body);
      },
      decode: (r) => (typeof r === 'string' ? r : null),
      batchSize: 1,
      waitMs: 1,
      minIntervalMs: 0,
      maxConcurrency: 1,
      maxQueue: 100,
    });

    const first = batcher.submit('a');
    const second = batcher.submit('b');
    release!();

    expect(await first).toBe('RA');
    expect(await second).toBe('RB');
    expect(call).toBe(2);
  });
});
