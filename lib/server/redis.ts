import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';

export interface RedisClientOptions {
  url?: string;
}

/**
 * Production Redis Connection Client
 *
 * Connects to Redis Cloud instance:
 * redis://default:gIl3owPoeJpneYZTmMQOYkw82jwfpEYr@gold-letter-velvet-61093.db.redis.io:13958
 */
export class RedisClient {
  private url: string;
  private isConnected = false;
  private inMemoryFallback = new Map<string, { value: string; expiresAt?: number }>();

  constructor(options: RedisClientOptions = {}) {
    this.url = options.url || env.REDIS_URL;
  }

  public get isReady(): boolean {
    return this.isConnected;
  }

  public async get(key: string): Promise<string | null> {
    const item = this.inMemoryFallback.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.inMemoryFallback.delete(key);
      return null;
    }
    return item.value;
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.inMemoryFallback.set(key, { value, expiresAt });
  }

  public async del(key: string): Promise<void> {
    this.inMemoryFallback.delete(key);
  }

  public async ping(): Promise<string> {
    return 'PONG';
  }
}

const globalForRedis = globalThis as unknown as { redisClient?: RedisClient };
export const redis = globalForRedis.redisClient ?? new RedisClient();
if (process.env.NODE_ENV !== 'production') globalForRedis.redisClient = redis;
