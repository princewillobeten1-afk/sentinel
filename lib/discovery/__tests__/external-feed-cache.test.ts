import { describe, expect, it, vi } from 'vitest';
import { ExternalFeedCache } from '../external-feed-cache';

// Each test gets its own instance via the private constructor workaround
// (bracket access) so cache state never leaks across tests.
function freshCache(): ExternalFeedCache {
  return new (ExternalFeedCache as unknown as { new (): ExternalFeedCache })();
}

describe('ExternalFeedCache', () => {
  it('calls fetchFn on a cache miss and reports hit: false', async () => {
    const cache = freshCache();
    const fetchFn = vi.fn().mockResolvedValue({ items: [1] });

    const result = await cache.getOrFetch('key', fetchFn);

    expect(result.hit).toBe(false);
    expect(result.value).toEqual({ items: [1] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cache entry without calling fetchFn again, reporting hit: true', async () => {
    const cache = freshCache();
    const fetchFn = vi.fn().mockResolvedValue({ items: [1] });

    await cache.getOrFetch('key', fetchFn);
    const second = await cache.getOrFetch('key', fetchFn);

    expect(second.hit).toBe(true);
    expect(second.value).toEqual({ items: [1] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    vi.useFakeTimers();
    try {
      const cache = freshCache();
      const fetchFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

      await cache.getOrFetch('key', fetchFn);
      vi.advanceTimersByTime(30_001);
      const result = await cache.getOrFetch('key', fetchFn);

      expect(result.hit).toBe(false);
      expect(result.value).toBe('second');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps distinct keys independently cached', async () => {
    const cache = freshCache();
    const fetchA = vi.fn().mockResolvedValue('a');
    const fetchB = vi.fn().mockResolvedValue('b');

    const resultA = await cache.getOrFetch('key-a', fetchA);
    const resultB = await cache.getOrFetch('key-b', fetchB);

    expect(resultA.value).toBe('a');
    expect(resultB.value).toBe('b');
    expect(fetchA).toHaveBeenCalledTimes(1);
    expect(fetchB).toHaveBeenCalledTimes(1);
  });

  it('invalidate forces the next call to be a miss', async () => {
    const cache = freshCache();
    const fetchFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cache.getOrFetch('key', fetchFn);
    cache.invalidate('key');
    const result = await cache.getOrFetch('key', fetchFn);

    expect(result.hit).toBe(false);
    expect(result.value).toBe('second');
  });

  it('clearCache empties every entry', async () => {
    const cache = freshCache();
    const fetchFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cache.getOrFetch('key', fetchFn);
    cache.clearCache();
    const result = await cache.getOrFetch('key', fetchFn);

    expect(result.hit).toBe(false);
    expect(result.value).toBe('second');
  });
});
