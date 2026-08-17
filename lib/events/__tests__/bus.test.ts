import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalEventBus } from '../bus';
import { CanonicalEvent } from '../types';

describe('Canonical Event Bus Architecture', () => {
  let bus: CanonicalEventBus;

  beforeEach(() => {
    bus = CanonicalEventBus.getInstance();
    bus.reset();
  });

  it('publishes and delivers canonical events to category subscribers', async () => {
    const received: CanonicalEvent[] = [];

    bus.subscribe('SWAP', (event) => {
      received.push(event);
    });

    const swapEvent: CanonicalEvent = {
      eventId: 'evt_swap_001',
      eventType: 'SWAP',
      version: '1.0.0',
      chain: 'solana',
      slot: 289104000,
      timestamp: new Date().toISOString(),
      source: 'solana_geyser',
      payload: {
        tokenMint: 'So11111111111111111111111111111111111111112',
        priceUsd: 142.50,
      },
    };

    await bus.publish(swapEvent);

    expect(received.length).toBe(1);
    expect(received[0].eventId).toBe('evt_swap_001');
    expect(received[0].payload.priceUsd).toBe(142.50);

    const metrics = bus.getMetrics();
    expect(metrics.publishedCount).toBe(1);
    expect(metrics.dispatchedCount).toBe(1);
  });

  it('filters events based on custom subscriber predicates', async () => {
    const whaleEvents: CanonicalEvent[] = [];

    bus.subscribe(
      'SWAP',
      (event) => {
        whaleEvents.push(event);
      },
      (event) => event.payload.volumeUsd >= 10000 // only whale swaps
    );

    // Small swap
    await bus.publish({
      eventId: 'evt_small',
      eventType: 'SWAP',
      version: '1.0.0',
      chain: 'solana',
      timestamp: new Date().toISOString(),
      source: 'solana_geyser',
      payload: { volumeUsd: 500 },
    });

    // Whale swap
    await bus.publish({
      eventId: 'evt_whale',
      eventType: 'SWAP',
      version: '1.0.0',
      chain: 'solana',
      timestamp: new Date().toISOString(),
      source: 'solana_geyser',
      payload: { volumeUsd: 50000 },
    });

    expect(whaleEvents.length).toBe(1);
    expect(whaleEvents[0].eventId).toBe('evt_whale');
  });

  it('isolates subscriber errors without breaking event bus dispatch', async () => {
    let secondCalled = false;

    // Faulty subscriber
    bus.subscribe('TOKEN_CREATED', () => {
      throw new Error('Exploding subscriber');
    });

    // Healthy subscriber
    bus.subscribe('TOKEN_CREATED', () => {
      secondCalled = true;
    });

    await bus.publish({
      eventId: 'evt_created_01',
      eventType: 'TOKEN_CREATED',
      version: '1.0.0',
      chain: 'solana',
      timestamp: new Date().toISOString(),
      source: 'raydium_amm',
      payload: { tokenMint: 'So11111111111111111111111111111111111111112' },
    });

    expect(secondCalled).toBe(true);
    expect(bus.getMetrics().errorCount).toBe(1);
  });
});
