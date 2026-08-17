import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, TimeoutError } from '../http-timeout';

describe('fetchWithTimeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('resolves normally when the request completes before the timeout', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('ok'));

    const response = await fetchWithTimeout('https://example.com', {}, 8000);

    expect(await response.text()).toBe('ok');
  });

  it('aborts and rejects with TimeoutError once the timeout elapses', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockImplementation((_url, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const promise = fetchWithTimeout('https://example.com', {}, 1000);
    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('propagates non-timeout errors unchanged', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(fetchWithTimeout('https://example.com', {}, 8000)).rejects.toThrow('network down');
  });

  it('actually aborts a real hung connection within the configured timeout', async () => {
    // Proves the AbortController wiring genuinely cuts off a real fetch, not
    // just a mocked one — a server that never calls res.end().
    const server: Server = createServer((_req, _res) => {
      // Intentionally never respond.
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('unexpected server address');
    const port = address.port;

    try {
      const start = Date.now();
      await expect(fetchWithTimeout(`http://127.0.0.1:${port}`, {}, 150)).rejects.toBeInstanceOf(TimeoutError);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10000);
});
