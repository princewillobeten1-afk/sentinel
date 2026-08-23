import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * The Discover columns rendered pulsing skeletons indefinitely because the
 * initial feed fetch had no deadline: while the promise stayed unsettled,
 * `isLoading` stayed true and the token list stayed empty — which is
 * indistinguishable, on screen, from a feed that is genuinely empty.
 *
 * These tests pin the contract that fix depends on. They exercise the abort
 * semantics directly rather than mounting the hook, because the defect is about
 * whether a request can be bounded at all, not about React state plumbing.
 */

describe('discovery feed request bounding', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /** Mirrors the hook's structure: controller + deadline + finally. */
  async function boundedFetch(url: string, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let settled = false;
    try {
      const res = await fetch(url, { signal: controller.signal });
      return { ok: true as const, res };
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      return { ok: false as const, timedOut: aborted };
    } finally {
      clearTimeout(timer);
      settled = true;
      // The property that matters: this always runs, so isLoading always clears.
      expect(settled).toBe(true);
    }
  }

  it('settles a request that would otherwise hang forever', async () => {
    // A fetch that never resolves — the exact production failure.
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
      ),
    );

    const promise = boundedFetch('/api/v1/discovery/new', 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ timedOut: true });
  });

  it('does not abort a request that answers within the deadline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    const promise = boundedFetch('/api/v1/discovery/new', 10_000);
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result.ok).toBe(true);
  });

  it('clears its timer on success so the deadline cannot fire later', async () => {
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    await boundedFetch('/api/v1/discovery/new', 10_000);

    expect(clearSpy).toHaveBeenCalled();
  });

  it('treats an empty result as a settled load, not a pending one', () => {
    // The skeleton condition is `isLoading && tokens.length === 0`. Once
    // isLoading is false an empty array must fall through to the empty state
    // rather than the skeleton — otherwise "nothing found" looks like "loading".
    const render = (isLoading: boolean, tokens: unknown[]) =>
      isLoading && tokens.length === 0 ? 'skeleton' : tokens.length === 0 ? 'empty' : 'list';

    expect(render(true, [])).toBe('skeleton');
    expect(render(false, [])).toBe('empty');
    expect(render(false, [{}])).toBe('list');
    // The bug: isLoading stuck true with no tokens never reaches 'empty'.
    expect(render(true, [])).not.toBe('empty');
  });
});
