import { EventEmitter } from 'events';
import { NormalizedRealtimeEvent } from './event-types';
import { redis } from '../redis';
import { logger } from '../logger';

const DEDUP_TTL_MS = 60_000; // 60 seconds deduplication window
const RING_BUFFER_SIZE = 500; // Keep last 500 events for sequence catch-up

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private seenEventIds = new Map<string, number>();
  private ringBuffer: NormalizedRealtimeEvent[] = [];

  private constructor() {
    super();
    this.setMaxListeners(100);

    // Periodic cleanup of deduplication map
    setInterval(() => {
      const now = Date.now();
      for (const [id, timestamp] of this.seenEventIds.entries()) {
        if (now - timestamp > DEDUP_TTL_MS) {
          this.seenEventIds.delete(id);
        }
      }
    }, 30_000);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Checks if an event is duplicate. If unseen, marks it as seen and returns true.
   */
  public claimEvent(eventId: string): boolean {
    if (this.seenEventIds.has(eventId)) {
      return false; // Duplicate
    }
    this.seenEventIds.set(eventId, Date.now());
    return true;
  }

  /**
   * Publishes an event to local listeners, Redis, and appends to the ring buffer.
   */
  public async publish(event: NormalizedRealtimeEvent): Promise<void> {
    const publishedTimestamp = Date.now();
    if (event.latency) {
      event.latency.publishedTimestamp = publishedTimestamp;
    }

    // 1. Maintain in-memory ring buffer for sequence reconciliation
    this.ringBuffer.push(event);
    if (this.ringBuffer.length > RING_BUFFER_SIZE) {
      this.ringBuffer.shift();
    }

    // 2. Publish to local event emitter for WebSocket fan-out
    this.emit('event', event);
    this.emit(`type:${event.type}`, event);
    if (event.mint) {
      this.emit(`mint:${event.mint}`, event);
    }

    // 3. Cache latest event state in Redis
    try {
      if (event.mint) {
        await redis.set(`token:${event.mint}:latest_event`, JSON.stringify(event), 300);
      }
    } catch (err) {
      logger.warn('[event-bus] Redis publish/set failed, local bus continuing', { error: (err as Error).message });
    }
  }

  /**
   * Returns missed events for a client reconnecting with a sequence number or timestamp.
   */
  public getEventsAfter(sequence?: number, sinceTimestamp?: number): NormalizedRealtimeEvent[] {
    if (sequence !== undefined && sequence > 0) {
      return this.ringBuffer.filter((e) => e.sequence > sequence);
    }
    if (sinceTimestamp !== undefined && sinceTimestamp > 0) {
      return this.ringBuffer.filter((e) => e.timestamp > sinceTimestamp);
    }
    return this.ringBuffer.slice(-50);
  }
}

export const eventBus = EventBus.getInstance();
