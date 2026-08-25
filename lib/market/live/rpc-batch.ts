/**
 * Micro-batching for JSON-RPC reads.
 *
 * Solana's JSON-RPC accepts an **array** of request objects in a single POST
 * and answers with an array correlated by `id`.
 *
 * That looked like free throughput — many calls per request, same request
 * rate. Measurement said otherwise: on the account this runs against, 10-call
 * batches sustained 2.5 calls/s and 25-call batches sustained **zero**, while
 * plain single-call requests sustained 7.3/s. Bursting calls inside one
 * request trips the limiter far harder than spreading them out. The trial
 * table lives in `transaction-enricher.ts`, which also explains why
 * `HELIUS_ENRICH_BATCH` defaults to 1.
 *
 * So this file is kept for what it provides besides batching — a bounded
 * queue, per-call rate budgeting, 429 backoff, counters, and the guarantee
 * that every caller settles — with batch size left as a knob for a plan that
 * tolerates bursts. It is deliberately not the throughput multiplier it was
 * written to be.
 *
 * Lives outside `transaction-enricher.ts` because that file carries
 * `import 'server-only'`, which throws outside Next's bundler and so cannot be
 * unit-tested. Everything here is injectable and covered by
 * `__tests__/rpc-batch.test.ts` — including the failure modes that would
 * otherwise hang the feed.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
}

/** Builds one `getTransaction` batch body. `id` is the index into `signatures`. */
export function buildGetTransactionBatch(signatures: string[]): JsonRpcRequest[] {
  return signatures.map((signature, index) => ({
    jsonrpc: '2.0' as const,
    id: index,
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        // Versioned transactions are the norm on mainnet; without this the
        // node refuses them outright and every modern swap fails.
        maxSupportedTransactionVersion: 0,
      },
    ],
  }));
}

/**
 * Maps a batch response back onto slots, by `id`.
 *
 * Never assume the array comes back in order, or even as an array: a node can
 * answer a batch with a **single** error object (a malformed batch, an auth
 * failure, a rate limit). Treating that shape as "no results" would silently
 * report real signatures as having no trades, which is the failure this
 * codebase keeps having to dig out. Unmatched slots stay `null`, meaning
 * "unknown", and the caller drops them rather than inventing an answer.
 */
export function mapBatchResults(parsed: unknown, count: number): (unknown | null)[] {
  const slots: (unknown | null)[] = new Array(count).fill(null);

  // A single-call request answers with a bare object, not an array. Falling
  // through to the array branch would map it to all-null and silently report a
  // real transaction as having no trade.
  if (!Array.isArray(parsed)) {
    if (count === 1 && parsed && typeof parsed === 'object' && 'result' in parsed) {
      slots[0] = (parsed as { result?: unknown }).result ?? null;
    }
    return slots;
  }

  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, result } = entry as { id?: unknown; result?: unknown };
    if (typeof id !== 'number' || id < 0 || id >= count) continue;
    slots[id] = result ?? null;
  }
  return slots;
}

/**
 * Next inter-batch delay.
 *
 * Being rate-limited is the expected steady state here, not an exception — we
 * are deliberately running at the ceiling. So backoff doubles on a 429 up to a
 * cap, and decays back toward the base on success instead of resetting
 * instantly, which would just re-trigger the limit on the following batch.
 */
export function nextBackoff(
  currentMs: number,
  wasRateLimited: boolean,
  baseMs: number,
  capMs: number,
): number {
  if (wasRateLimited) return Math.min(capMs, Math.max(baseMs, currentMs * 2));
  if (currentMs <= baseMs) return baseMs;
  return Math.max(baseMs, Math.floor(currentMs / 2));
}

export interface BatcherOptions<T> {
  /**
   * Sends one batch. Resolves with the parsed body, or throws.
   * `status` lets the batcher distinguish a rate limit from a hard failure.
   */
  transport: (body: JsonRpcRequest[]) => Promise<{ status: number; body: unknown }>;
  /** Turns one slot's `result` into a domain object, or null to skip it. */
  decode: (result: unknown) => Promise<T | null> | (T | null);
  batchSize: number;
  /** Longest a signature waits to be batched when the buffer never fills. */
  waitMs: number;
  /**
   * Budget per **RPC call**, not per HTTP request.
   *
   * Measured the hard way: batching 100 `getTransaction` calls into one
   * request and pacing them one request per 125ms produced HTTP 429 on 241 of
   * 243 batches. Helius meters method calls, so a batch of 100 spends the
   * budget a hundred times faster than a single call — packaging them together
   * hides nothing from the meter. The batch is charged `batch.length * this`,
   * which keeps the call rate inside the plan no matter the batch size, and
   * leaves batch size as purely a latency-versus-HTTP-overhead trade.
   */
  minIntervalMs: number;
  maxConcurrency: number;
  maxQueue: number;
  backoffCapMs?: number;
}

export interface BatcherStats {
  queued: number;
  inFlightBatches: number;
  batches: number;
  fetched: number;
  decoded: number;
  failed: number;
  rateLimited: number;
  droppedQueueFull: number;
  currentIntervalMs: number;
}

interface PendingEntry<T> {
  signature: string;
  settle: (value: T | null) => void;
}

/**
 * A batching collector.
 *
 * `submit()` returns a promise that settles when the signature's slot comes
 * back. **Every** pending entry settles, including when the transport throws
 * or the batch is rate-limited — a dropped `settle` leaves the caller's
 * `.then` pending forever, which is the unsettled-promise leak this codebase
 * has already had to fix twice.
 */
export function createBatcher<T>(options: BatcherOptions<T>) {
  const {
    transport,
    decode,
    batchSize,
    waitMs,
    minIntervalMs,
    maxConcurrency,
    maxQueue,
    backoffCapMs = 5_000,
  } = options;

  let buffer: PendingEntry<T>[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlightBatches = 0;
  let lastSentAt = 0;
  let currentIntervalMs = minIntervalMs;

  const stats = {
    batches: 0,
    fetched: 0,
    decoded: 0,
    failed: 0,
    rateLimited: 0,
    droppedQueueFull: 0,
  };

  function scheduleFlush(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, waitMs);
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    if (inFlightBatches >= maxConcurrency) {
      // All slots busy — come back rather than piling on.
      scheduleFlush();
      return;
    }

    const batch = buffer.splice(0, batchSize);
    if (batch.length === 0) return;

    inFlightBatches++;
    let settled = false;
    const settleAll = (value: T | null) => {
      if (settled) return;
      settled = true;
      for (const entry of batch) entry.settle(value);
    };

    try {
      // Charge the budget per call in the batch, not per batch. Ten calls cost
      // ten slots whether they travel in one request or ten.
      const cost = currentIntervalMs * batch.length;
      const now = Date.now();
      const wait = Math.max(0, lastSentAt - now);
      lastSentAt = Math.max(now, lastSentAt) + cost;
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

      const body = buildGetTransactionBatch(batch.map((entry) => entry.signature));
      const response = await transport(body);
      stats.batches++;

      if (response.status === 429) {
        stats.rateLimited++;
        currentIntervalMs = nextBackoff(currentIntervalMs, true, minIntervalMs, backoffCapMs);
        settleAll(null);
        return;
      }

      currentIntervalMs = nextBackoff(currentIntervalMs, false, minIntervalMs, backoffCapMs);

      if (response.status < 200 || response.status >= 300) {
        stats.failed++;
        settleAll(null);
        return;
      }

      const slots = mapBatchResults(response.body, batch.length);
      stats.fetched += batch.length;

      // Decode per slot. One bad slot must not deny the whole batch, so each
      // decode is guarded individually.
      settled = true;
      for (let i = 0; i < batch.length; i++) {
        let value: T | null = null;
        try {
          value = slots[i] === null ? null : await decode(slots[i]);
        } catch {
          value = null;
        }
        if (value !== null) stats.decoded++;
        batch[i].settle(value);
      }
    } catch {
      stats.failed++;
      settleAll(null);
    } finally {
      inFlightBatches--;
      // Anything that arrived while this batch was in flight.
      if (buffer.length > 0) {
        if (buffer.length >= batchSize) void flush();
        else scheduleFlush();
      }
    }
  }

  return {
    submit(signature: string): Promise<T | null> {
      if (buffer.length >= maxQueue) {
        stats.droppedQueueFull++;
        return Promise.resolve(null);
      }
      return new Promise<T | null>((resolve) => {
        buffer.push({ signature, settle: resolve });
        if (buffer.length >= batchSize) void flush();
        else scheduleFlush();
      });
    },

    stats(): BatcherStats {
      return {
        queued: buffer.length,
        inFlightBatches,
        currentIntervalMs,
        ...stats,
      };
    },

    /** Test seam. */
    reset(): void {
      if (flushTimer !== null) clearTimeout(flushTimer);
      flushTimer = null;
      buffer = [];
      inFlightBatches = 0;
      lastSentAt = 0;
      currentIntervalMs = minIntervalMs;
      stats.batches = 0;
      stats.fetched = 0;
      stats.decoded = 0;
      stats.failed = 0;
      stats.rateLimited = 0;
      stats.droppedQueueFull = 0;
    },
  };
}
