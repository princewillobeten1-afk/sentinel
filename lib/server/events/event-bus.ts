import { EventEmitter } from 'events';
import { NormalizedRealtimeEvent } from './event-types';
import { redis } from '../redis';
import { logger } from '../logger';

const DEDUP_TTL_MS = 60_000; // 60 seconds deduplication window
const RING_BUFFER_SIZE = 500; // Keep last 500 events for sequence catch-up

/** Channel other server instances publish normalized events on. */
const REALTIME_CHANNEL = 'sentinel:realtime:events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private seenEventIds = new Map<string, number>();
  private ringBuffer: NormalizedRealtimeEvent[] = [];
  private remoteSubscribed = false;
  private remoteFanoutActive = false;

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
   *
   * Synchronous and process-local. Kept because it is the hot path and callers
   * that only run one instance need no round trip — but on its own it cannot
   * stop two server processes both claiming the same Helius message. Use
   * {@link claimEventShared} where that matters.
   */
  public claimEvent(eventId: string): boolean {
    if (this.seenEventIds.has(eventId)) {
      return false; // Duplicate
    }
    this.seenEventIds.set(eventId, Date.now());
    return true;
  }

  /**
   * Cross-process deduplication via Redis `SET NX PX`.
   *
   * Checks the local map first: a duplicate this process has already seen needs
   * no network call, and that is the common case for Helius echoing the same
   * signature at different commitment levels. Only genuinely-new-to-us events
   * pay the round trip.
   *
   * With Redis unavailable this degrades to exactly `claimEvent` — correct for
   * one instance, which is the honest limit of running without it.
   */
  public async claimEventShared(eventId: string): Promise<boolean> {
    if (!this.claimEvent(eventId)) return false;

    try {
      return await redis.claim(`evt:${eventId}`, DEDUP_TTL_MS / 1000);
    } catch (err) {
      logger.warn('[event-bus] shared claim failed, using local dedup only', {
        error: (err as Error).message,
      });
      return true;
    }
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

    // 3. Cache latest state and fan out to other instances.
    //
    // Deliberately after the local emit above: WebSocket delivery to clients on
    // *this* instance must never wait on a Redis round trip (brief §38). If
    // Redis is slow or down, local subscribers have already been served.
    try {
      const payload = JSON.stringify(event);
      if (event.mint) {
        await redis.set(`token:${event.mint}:latest_event`, payload, 300);
      }
      await redis.publish(REALTIME_CHANNEL, payload);
    } catch (err) {
      logger.warn('[event-bus] Redis publish/set failed, local bus continuing', { error: (err as Error).message });
    }
  }

  /**
   * Re-emits events published by *other* server instances.
   *
   * Called once at startup. Without this, a client connected to instance B
   * never sees an event ingested by instance A. Remote events skip
   * {@link publish} to avoid being republished back to Redis in a loop, and are
   * dropped if this process already saw them.
   */
  public async subscribeToRemote(): Promise<boolean> {
    if (this.remoteSubscribed) return this.remoteFanoutActive;
    this.remoteSubscribed = true;

    this.remoteFanoutActive = await redis.subscribe(REALTIME_CHANNEL, (message) => {
      try {
        const event = JSON.parse(message) as NormalizedRealtimeEvent;
        if (!this.claimEvent(event.id)) return;

        this.ringBuffer.push(event);
        if (this.ringBuffer.length > RING_BUFFER_SIZE) this.ringBuffer.shift();

        this.emit('event', event);
        this.emit(`type:${event.type}`, event);
        if (event.mint) this.emit(`mint:${event.mint}`, event);
      } catch (err) {
        logger.warn('[event-bus] malformed remote event dropped', {
          error: (err as Error).message,
        });
      }
    });

    return this.remoteFanoutActive;
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

/**
 * Guarded on `globalThis`, not just a class static.
 *
 * A class-static singleton is per *module instance*, and Next bundles this file
 * into more than one webpack graph — the RSC/route graph that loads
 * `lib/ws/server.ts`, and the instrumentation graph that starts the stream
 * manager. Each got its own EventBus, so ingestion published to one bus while
 * the WebSocket server listened on another: events reached Redis and Postgres
 * but never a browser, and nothing errored.
 *
 * Same pattern already used by `dbPool`, `redis`, `wsBroadcaster` and
 * `marketStreamManager`, for the same reason.
 */
const globalForEventBus = globalThis as unknown as { sentinelEventBus?: EventBus };
export const eventBus = globalForEventBus.sentinelEventBus ?? EventBus.getInstance();
globalForEventBus.sentinelEventBus = eventBus;
