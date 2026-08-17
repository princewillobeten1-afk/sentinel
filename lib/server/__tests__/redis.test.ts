import { describe, expect, it, beforeEach } from 'vitest';
import { RedisClient } from '../redis';

/**
 * These run against no Redis at all (empty URL), which is the degraded path —
 * the one that must keep the real-time pipeline alive during an outage. The
 * live-Redis behaviour is verified separately against the container.
 */
describe('RedisClient without Redis configured', () => {
  let client: RedisClient;

  beforeEach(() => {
    client = new RedisClient('');
  });

  it('reports itself degraded rather than ready', () => {
    // The shim this replaced hardcoded a 'PONG' response and left isReady
    // false forever, so health checks got a reassuring answer from a client
    // that had never opened a socket.
    expect(client.isReady).toBe(false);
    expect(client.isDegraded).toBe(true);
  });

  it('returns null from ping instead of a fake PONG', async () => {
    expect(await client.ping()).toBeNull();
  });

  it('still stores and reads values', async () => {
    // Degradation must not break callers — only reduce reach.
    await client.set('k', 'v');
    expect(await client.get('k')).toBe('v');
  });

  it('honours TTL expiry in the fallback store', async () => {
    await client.set('k', 'v', 0.05);
    expect(await client.get('k')).toBe('v');
    await new Promise((r) => setTimeout(r, 80));
    expect(await client.get('k')).toBeNull();
  });

  it('deletes keys', async () => {
    await client.set('k', 'v');
    await client.del('k');
    expect(await client.get('k')).toBeNull();
  });

  it('returns null for keys never set', async () => {
    expect(await client.get('absent')).toBeNull();
  });

  describe('claim — the deduplication primitive', () => {
    it('grants the first claim and refuses the second', async () => {
      expect(await client.claim('evt:1', 60)).toBe(true);
      expect(await client.claim('evt:1', 60)).toBe(false);
    });

    it('treats distinct ids independently', async () => {
      expect(await client.claim('evt:a', 60)).toBe(true);
      expect(await client.claim('evt:b', 60)).toBe(true);
    });

    it('allows a re-claim once the window expires', async () => {
      // Dedup is a window, not a permanent ledger: the same signature seen
      // again an hour later is a legitimately new observation.
      expect(await client.claim('evt:ttl', 0.05)).toBe(true);
      await new Promise((r) => setTimeout(r, 80));
      expect(await client.claim('evt:ttl', 0.05)).toBe(true);
    });

    it('grants exactly one winner under concurrent claims', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => client.claim('evt:race', 60)),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe('pub/sub', () => {
    it('delivers locally published messages to subscribers', async () => {
      const received: string[] = [];
      await client.subscribe('chan', (m) => received.push(m));
      await client.publish('chan', 'hello');
      expect(received).toEqual(['hello']);
    });

    it('delivers to every subscriber on a channel', async () => {
      const a: string[] = [];
      const b: string[] = [];
      await client.subscribe('chan', (m) => a.push(m));
      await client.subscribe('chan', (m) => b.push(m));
      await client.publish('chan', 'x');
      expect(a).toEqual(['x']);
      expect(b).toEqual(['x']);
    });

    it('does not cross channels', async () => {
      const received: string[] = [];
      await client.subscribe('chan-a', (m) => received.push(m));
      await client.publish('chan-b', 'nope');
      expect(received).toEqual([]);
    });

    it('keeps delivering after a subscriber throws', async () => {
      // One bad handler must not silence the rest of the fan-out.
      const received: string[] = [];
      await client.subscribe('chan', () => {
        throw new Error('handler blew up');
      });
      await client.subscribe('chan', (m) => received.push(m));
      await expect(client.publish('chan', 'x')).resolves.toBeUndefined();
      expect(received).toEqual(['x']);
    });

    it('publishing to a channel with no subscribers is a no-op', async () => {
      await expect(client.publish('empty', 'x')).resolves.toBeUndefined();
    });
  });

  it('never throws from any operation while degraded', async () => {
    // The whole contract: a Redis outage must not stop ingestion (brief §21).
    await expect(client.set('a', 'b')).resolves.toBeUndefined();
    await expect(client.get('a')).resolves.toBe('b');
    await expect(client.del('a')).resolves.toBeUndefined();
    await expect(client.claim('c', 1)).resolves.toBe(true);
    await expect(client.publish('ch', 'm')).resolves.toBeUndefined();
    await expect(client.ping()).resolves.toBeNull();
  });
});
