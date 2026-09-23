import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  acquireBirdeyeSlot,
  birdeyeLimiterStats,
  BIRDEYE_MIN_INTERVAL_MS,
  __resetBirdeyeLimiter,
} from '../birdeye-limiter';

describe('birdeye limiter', () => {
  beforeEach(() => {
    __resetBirdeyeLimiter();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('spaces consecutive calls by the shared interval', async () => {
    // Two workers pacing themselves separately is what saturated the key: a
    // per-worker delay cannot bound a per-account limit.
    const order: number[] = [];
    void acquireBirdeyeSlot('audit').then(() => order.push(1));
    void acquireBirdeyeSlot('audit').then(() => order.push(2));

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    await vi.advanceTimersByTimeAsync(BIRDEYE_MIN_INTERVAL_MS);
    expect(order).toEqual([1, 2]);
  });

  it('serves audit work before background work', async () => {
    // An unaudited row shows a pending pip until its lookup lands, so a reader
    // is waiting on it. Market enrichment is a top-up Jupiter also covers.
    const served: string[] = [];
    void acquireBirdeyeSlot('audit').then(() => served.push('first'));
    await vi.advanceTimersByTimeAsync(0);

    void acquireBirdeyeSlot('background').then(() => served.push('background'));
    void acquireBirdeyeSlot('audit').then(() => served.push('audit'));

    await vi.advanceTimersByTimeAsync(BIRDEYE_MIN_INTERVAL_MS * 2);
    expect(served).toEqual(['first', 'audit', 'background']);
  });

  it('promotes background work that has waited too long', async () => {
    const served: string[] = [];
    void acquireBirdeyeSlot('audit').then(() => served.push('drain'));
    await vi.advanceTimersByTimeAsync(0);

    // Queued first, but low priority.
    void acquireBirdeyeSlot('background').then(() => served.push('background'));
    // Let it age past the promotion threshold with nothing else competing.
    await vi.advanceTimersByTimeAsync(61_000);

    void acquireBirdeyeSlot('audit').then(() => served.push('audit'));
    await vi.advanceTimersByTimeAsync(BIRDEYE_MIN_INTERVAL_MS * 2);

    // The aged background call is no longer starved behind newer audit work.
    expect(served.indexOf('background')).toBeLessThan(served.indexOf('audit'));
  });

  it('reports what is waiting', async () => {
    void acquireBirdeyeSlot('audit');
    void acquireBirdeyeSlot('background');
    void acquireBirdeyeSlot('background');
    await vi.advanceTimersByTimeAsync(0);

    const stats = birdeyeLimiterStats();
    expect(stats.queued).toBe(2);
    expect(stats.background).toBe(2);
    expect(stats.minIntervalMs).toBe(BIRDEYE_MIN_INTERVAL_MS);
  });

  it('removes cancelled chart work without consuming another provider slot', async () => {
    await acquireBirdeyeSlot('audit');
    const controller = new AbortController();
    const rejected = expect(acquireBirdeyeSlot('chart', controller.signal)).rejects.toThrow('aborted');
    expect(birdeyeLimiterStats().chart).toBe(1);
    controller.abort(); await rejected;
    expect(birdeyeLimiterStats().queued).toBe(0);
    const served: string[] = [];
    void acquireBirdeyeSlot('background').then(() => served.push('background'));
    await vi.advanceTimersByTimeAsync(BIRDEYE_MIN_INTERVAL_MS);
    expect(served).toEqual(['background']);
  });

  it('serves waiting charts alongside audits before background top-ups', async () => {
    await acquireBirdeyeSlot('audit');
    const served: string[] = [];
    void acquireBirdeyeSlot('background').then(() => served.push('background'));
    void acquireBirdeyeSlot('chart').then(() => served.push('chart'));
    void acquireBirdeyeSlot('audit').then(() => served.push('audit'));
    await vi.advanceTimersByTimeAsync(BIRDEYE_MIN_INTERVAL_MS * 3);
    expect(served).toEqual(['chart', 'audit', 'background']);
  });
});
