import { describe, it, expect, beforeEach } from 'vitest';
import { MarketEventPipeline, type RawMarketEvent } from '../event-pipeline';

/**
 * Guards against accidentally reverting event-pipeline.ts's provider labels
 * back to the meaningless placeholders ('primary_rpc_node'/'backup_helius_rpc').
 * Provenance comes from the transport that actually delivered an event.
 * A degraded provider must not relabel a different provider's valid data.
 */
describe('MarketEventPipeline provider labels', () => {
  let pipeline: MarketEventPipeline;

  beforeEach(() => {
    pipeline = MarketEventPipeline.getInstance();
    pipeline.resetProviderHealth();
  });

  function rawEvent(overrides: Partial<RawMarketEvent> = {}): RawMarketEvent {
    return {
      eventId: `evt_${Math.random()}`,
      providerId: 'birdeye_price_ws',
      mint: 'So11111111111111111111111111111111111111112',
      eventType: 'PRICE_UPDATE',
      priceUsd: '100',
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  it('labels a healthy event with the real active provider', () => {
    const normalized = pipeline.processEvent(rawEvent());
    expect(normalized?.provider).toBe('birdeye_ws');
  });

  it('does not relabel Birdeye data when Helius degrades', () => {
    pipeline.triggerFailover('test-induced failure', 'helius_logs_ws');
    expect(pipeline.processEvent(rawEvent())?.provider).toBe('birdeye_ws');
  });

  it('labels Helius and QuickNode logs by their actual transport', () => {
    expect(pipeline.processEvent(rawEvent({ providerId: 'helius_logs_scoped' }))?.provider).toBe('helius_logs_ws');
    expect(pipeline.processEvent(rawEvent({ providerId: 'quicknode_logs_scoped' }))?.provider).toBe('quicknode_logs_ws');
  });
});
