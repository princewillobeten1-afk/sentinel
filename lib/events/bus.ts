/**
 * Production Canonical Event Bus (Sprint 34 §31-33).
 *
 * Implements the asynchronous event backbone connecting Indexers, Market Data,
 * Intelligence Workers, Order Engine, and WebSocket streaming gateway.
 *
 * Features:
 *   - Strongly-typed canonical event validation
 *   - Category and custom predicate filtering
 *   - Isolated subscriber dispatch (failures do not block bus or peer subscribers)
 *   - Real-time telemetry (published count, dispatched count, errors)
 */

import { CanonicalEvent, EventCategory, EventSubscriber, EventBusSubscription } from './types';
import { logger } from '@/lib/server/logger';

export class CanonicalEventBus {
  private static instance: CanonicalEventBus;
  private subscriptions: Map<string, EventBusSubscription> = new Map();
  private subCounter = 0;

  // Metrics
  private publishedCount = 0;
  private dispatchedCount = 0;
  private errorCount = 0;

  private constructor() {}

  public static getInstance(): CanonicalEventBus {
    if (!CanonicalEventBus.instance) {
      CanonicalEventBus.instance = new CanonicalEventBus();
    }
    return CanonicalEventBus.instance;
  }

  /**
   * Subscribes a handler to a specific event category or wildcard ('*').
   */
  public subscribe<T = any>(
    category: EventCategory | '*',
    subscriber: EventSubscriber<T>,
    filter?: (event: CanonicalEvent<T>) => boolean
  ): EventBusSubscription {
    const id = `sub_${++this.subCounter}_${Date.now().toString(36)}`;
    const sub: EventBusSubscription = {
      id,
      category,
      filter,
      subscriber: subscriber as EventSubscriber,
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };

    this.subscriptions.set(id, sub);
    return sub;
  }

  /**
   * Publishes a canonical event to all matching subscribers.
   */
  public async publish<T = any>(event: CanonicalEvent<T>): Promise<void> {
    this.validateEventEnvelope(event);
    this.publishedCount++;

    const matchingSubs: EventBusSubscription[] = [];

    for (const sub of this.subscriptions.values()) {
      if (sub.category === '*' || sub.category === event.eventType) {
        if (!sub.filter || sub.filter(event)) {
          matchingSubs.push(sub);
        }
      }
    }

    // Dispatch asynchronously across subscribers with error boundaries
    await Promise.all(
      matchingSubs.map(async (sub) => {
        try {
          await sub.subscriber(event);
          this.dispatchedCount++;
        } catch (err: any) {
          this.errorCount++;
          logger.error(`[EVENT_BUS] Subscriber ${sub.id} failed on ${event.eventType}: ${err?.message}`);
        }
      })
    );
  }

  /**
   * Validates that an event conforms to the canonical envelope.
   */
  private validateEventEnvelope(event: CanonicalEvent): void {
    if (!event.eventId) throw new Error('Invalid CanonicalEvent: eventId is required');
    if (!event.eventType) throw new Error('Invalid CanonicalEvent: eventType is required');
    if (!event.version) throw new Error('Invalid CanonicalEvent: version is required');
    if (!event.chain) throw new Error('Invalid CanonicalEvent: chain is required');
    if (!event.timestamp) throw new Error('Invalid CanonicalEvent: timestamp is required');
    if (!event.source) throw new Error('Invalid CanonicalEvent: source is required');
  }

  /**
   * Returns current Event Bus throughput and error metrics.
   */
  public getMetrics() {
    return {
      activeSubscriptions: this.subscriptions.size,
      publishedCount: this.publishedCount,
      dispatchedCount: this.dispatchedCount,
      errorCount: this.errorCount,
    };
  }

  /** Test-only reset */
  public reset(): void {
    this.subscriptions.clear();
    this.publishedCount = 0;
    this.dispatchedCount = 0;
    this.errorCount = 0;
    this.subCounter = 0;
  }
}

export const eventBus = CanonicalEventBus.getInstance();
