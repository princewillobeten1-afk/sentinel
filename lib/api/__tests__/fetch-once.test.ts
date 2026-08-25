import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchOnce, inflightCount, __resetFetchOnce, HttpError } from '../fetch-once';

beforeEach(() => {
  __resetFetchOnce();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Resolves only when released, so concurrency can be observed. */
function gatedFetch(payload: unknown, status = 200) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let calls = 0;
  const impl = vi.fn(async () => {
    calls++;
    await gate;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as unknown as Response;
  });
  return { impl, release: () => release(), calls: () => calls };
}

describe('fetchOnce', () => {
  it('issues one request for concurrent callers of the same url', async () => {
    // The measured bug: discovery/new was fetched 24 times against 8 for every
    // other section, because each caller opened its own request.
    const g = gatedFetch({ ok: true });
    vi.stubGlobal('fetch', g.impl);

    const a = fetchOnce('/api/x');
    const b = fetchOnce('/api/x');
    const c = fetchOnce('/api/x');
    expect(inflightCount()).toBe(1);

    g.release();
    expect(await Promise.all([a, b, c])).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(g.calls()).toBe(1);
  });

  it('keeps different urls separate', async () => {
    const g = gatedFetch({ ok: true });
    vi.stubGlobal('fetch', g.impl);

    void fetchOnce('/api/x');
    void fetchOnce('/api/y');
    expect(inflightCount()).toBe(2);
    g.release();
  });

  it('releases the key so a later call refetches', async () => {
    // Sharing must not become caching: the next poll cycle needs fresh data.
    const g = gatedFetch({ n: 1 });
    vi.stubGlobal('fetch', g.impl);

    const first = fetchOnce('/api/x');
    g.release();
    await first;
    expect(inflightCount()).toBe(0);

    await fetchOnce('/api/x');
    expect(g.calls()).toBe(2);
  });

  it('does not poison the key after a failure', async () => {
    const failing = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', failing);

    await expect(fetchOnce('/api/x')).rejects.toThrow('network down');
    expect(inflightCount()).toBe(0);

    await expect(fetchOnce('/api/x')).rejects.toThrow('network down');
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('throws HttpError carrying the status and url', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response));

    await expect(fetchOnce('/api/x')).rejects.toBeInstanceOf(HttpError);
    await expect(fetchOnce('/api/x')).rejects.toMatchObject({ status: 503, url: '/api/x' });
  });

  it('shares the rejection with every concurrent caller', async () => {
    const g = gatedFetch({}, 500);
    vi.stubGlobal('fetch', g.impl);

    const a = fetchOnce('/api/x');
    const b = fetchOnce('/api/x');
    g.release();

    await expect(a).rejects.toBeInstanceOf(HttpError);
    await expect(b).rejects.toBeInstanceOf(HttpError);
    expect(g.calls()).toBe(1);
  });
});
