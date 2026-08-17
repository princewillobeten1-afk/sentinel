import 'server-only';

import Redis, { type RedisOptions } from 'ioredis';
import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';

/**
 * Redis client for the real-time event bus.
 *
 * Replaces a shim that was a `Map` and nothing else: it never opened a socket,
 * `isReady` was permanently false, and `ping()` returned `'PONG'` unconditionally
 * whether or not Redis existed. Anything checking health got a reassuring answer
 * from a client that had never tried to connect.
 *
 * Two properties matter more than speed here:
 *
 *  - **Degradation is silent to callers, loud in logs.** Redis being down must
 *    never stop blockchain ingestion or WebSocket delivery (brief §21). Every
 *    method falls back to the in-process map and returns normally. What is lost
 *    is *cross-process* behaviour, not correctness on one instance — so the
 *    fallback is reported honestly rather than presented as success.
 *  - **Dedup is atomic.** `claim()` is a single `SET NX PX`, not
 *    read-then-write, so two server instances receiving the same Helius message
 *    cannot both decide they saw it first (brief §9).
 *
 * Pub/sub needs its own connection: once an ioredis client subscribes it enters
 * subscriber mode and refuses ordinary commands, so the subscriber is created
 * separately and lazily.
 */

/** Fallback store used whenever Redis is unreachable. */
interface FallbackEntry {
  value: string;
  expiresAt?: number;
}

export class RedisClient {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private connectFailed = false;
  private readonly fallback = new Map<string, FallbackEntry>();
  private readonly localHandlers = new Map<string, Set<(message: string) => void>>();
  private readonly url: string | undefined;

  constructor(url?: string) {
    this.url = url ?? env.REDIS_URL ?? process.env.REDIS_URL;
  }

  /** True only when a socket is actually open. Never optimistic. */
  public get isReady(): boolean {
    return this.client?.status === 'ready';
  }

  /** Whether reads and writes are currently being served from process memory. */
  public get isDegraded(): boolean {
    return !this.isReady;
  }

  private options(): RedisOptions {
    return {
      // Commands issued before the socket is up would otherwise queue forever;
      // failing fast is what lets callers fall back within the request.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Backs off to 10s and keeps trying: Redis coming back should heal the
        // system without a redeploy.
        const delay = Math.min(times * 500, 10_000);
        return delay;
      },
    };
  }

  /**
   * Returns a connected client, or null when Redis is unavailable.
   * Connection is attempted once; failure switches to the fallback permanently
   * for this process rather than retrying on the hot path of every event.
   */
  private getClient(): Redis | null {
    if (!this.url || this.connectFailed) return null;

    if (!this.client) {
      try {
        this.client = new Redis(this.url, this.options());

        this.client.on('error', (err: Error) => {
          // ioredis emits errors continuously while down; log the first only.
          if (!this.connectFailed) {
            this.connectFailed = true;
            logger.warn('[redis] unavailable — degrading to in-process cache', {
              message: err.message,
            });
          }
        });

        this.client.on('ready', () => {
          this.connectFailed = false;
          logger.info('[redis] connected');
        });

        void this.client.connect().catch(() => {
          this.connectFailed = true;
        });
      } catch (err) {
        this.connectFailed = true;
        logger.warn('[redis] client construction failed — using in-process cache', {
          message: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }

    return this.client.status === 'ready' ? this.client : null;
  }

  public async get(key: string): Promise<string | null> {
    const client = this.getClient();
    if (client) {
      try {
        return await client.get(key);
      } catch {
        // fall through to memory
      }
    }

    const entry = this.fallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.fallback.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (client) {
      try {
        if (ttlSeconds) await client.set(key, value, 'EX', ttlSeconds);
        else await client.set(key, value);
        return;
      } catch {
        // fall through to memory
      }
    }

    this.fallback.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
    this.pruneFallback();
  }

  public async del(key: string): Promise<void> {
    const client = this.getClient();
    if (client) {
      try {
        await client.del(key);
        return;
      } catch {
        // fall through
      }
    }
    this.fallback.delete(key);
  }

  /**
   * Atomically claims a key, returning true only for the first caller.
   *
   * This is the deduplication primitive (brief §9). `SET NX PX` is one round
   * trip and one atomic decision on the server, so concurrent instances
   * processing the same Helius message cannot both win. The in-memory fallback
   * is atomic only within this process — which is the honest limit of running
   * without Redis, and why degradation is logged.
   */
  public async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const client = this.getClient();
    if (client) {
      try {
        const result = await client.set(key, '1', 'PX', ttlSeconds * 1000, 'NX');
        return result === 'OK';
      } catch {
        // fall through
      }
    }

    const entry = this.fallback.get(key);
    if (entry && (!entry.expiresAt || Date.now() <= entry.expiresAt)) return false;
    this.fallback.set(key, { value: '1', expiresAt: Date.now() + ttlSeconds * 1000 });
    this.pruneFallback();
    return true;
  }

  /**
   * Publishes to a channel, and always to local subscribers.
   *
   * Local delivery happens regardless of Redis so a single-instance deployment
   * behaves identically to a clustered one — the difference is reach, not
   * whether the event is delivered at all.
   */
  public async publish(channel: string, message: string): Promise<void> {
    this.deliverLocal(channel, message);

    const client = this.getClient();
    if (!client) return;
    try {
      await client.publish(channel, message);
    } catch {
      // Local subscribers already have it; cross-instance fan-out is what is lost.
    }
  }

  /**
   * Subscribes to a channel. Handlers always fire for locally-published
   * messages; the return value reports whether *remote* fan-out is also live,
   * so callers can state which mode they are in instead of guessing.
   */
  public async subscribe(channel: string, handler: (message: string) => void): Promise<boolean> {
    let handlers = this.localHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.localHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    if (!this.url || this.connectFailed) return false;

    try {
      if (!this.subscriber) {
        // A subscribed ioredis connection rejects normal commands, so the
        // subscriber must never be the same client used for get/set.
        this.subscriber = new Redis(this.url, this.options());
        this.subscriber.on('error', () => undefined);
        await this.subscriber.connect().catch(() => undefined);

        this.subscriber.on('message', (ch: string, message: string) => {
          // Only remote messages arrive here; local ones were delivered by
          // publish(). Redis echoes our own publishes back, so this would
          // double-deliver without the guard in deliverLocal's caller.
          this.deliverLocal(ch, message, true);
        });
      }
      await this.subscriber.subscribe(channel);
      return this.subscriber.status === 'ready';
    } catch (err) {
      logger.warn('[redis] subscribe failed — local-only delivery', {
        channel,
        message: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private deliverLocal(channel: string, message: string, fromRemote = false): void {
    // Messages we published ourselves are echoed back by Redis. Dropping the
    // echo here keeps a single logical event from firing handlers twice.
    if (fromRemote && this.recentlyPublished.has(message)) {
      this.recentlyPublished.delete(message);
      return;
    }
    if (!fromRemote) {
      this.recentlyPublished.add(message);
      if (this.recentlyPublished.size > 1_000) {
        this.recentlyPublished.clear();
      }
    }

    const handlers = this.localHandlers.get(channel);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (err) {
        logger.warn('[redis] subscriber handler threw', {
          channel,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private readonly recentlyPublished = new Set<string>();

  /** Reports real connectivity. Returns null when Redis is not reachable. */
  public async ping(): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;
    try {
      return await client.ping();
    } catch {
      return null;
    }
  }

  public async quit(): Promise<void> {
    await Promise.allSettled([this.client?.quit(), this.subscriber?.quit()]);
    this.client = null;
    this.subscriber = null;
  }

  /** Bounds the fallback map so a long Redis outage cannot exhaust memory. */
  private pruneFallback(): void {
    if (this.fallback.size < 10_000) return;
    const now = Date.now();
    for (const [key, entry] of this.fallback) {
      if (entry.expiresAt && now > entry.expiresAt) this.fallback.delete(key);
    }
    // Still oversized after expiry sweep: drop oldest insertions.
    if (this.fallback.size >= 10_000) {
      const excess = this.fallback.size - 8_000;
      let i = 0;
      for (const key of this.fallback.keys()) {
        if (i++ >= excess) break;
        this.fallback.delete(key);
      }
    }
  }
}

const globalForRedis = globalThis as unknown as { redisClient?: RedisClient };
export const redis = globalForRedis.redisClient ?? new RedisClient();
if (process.env.NODE_ENV !== 'production') globalForRedis.redisClient = redis;
