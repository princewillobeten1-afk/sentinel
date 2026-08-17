import { describe, it, expect, beforeEach } from 'vitest';
import { MarketEventPipeline, type RawMarketEvent } from '../event-pipeline';

/**
 * Guards against accidentally reverting event-pipeline.ts's provider labels
 * back to the meaningless placeholders ('primary_rpc_node'/'backup_helius_rpc').
 * processEvent() derives NormalizedMarketEvent.provider from these internal
 * constants (never from raw.providerId), so real, correctly-labeled output
 * depends on them matching the actual upstream providers wired in
 * lib/market/live/.
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

  it('labels a failed-over event with the real secondary provider', () => {
    pipeline.triggerFailover('test-induced failure');
    const normalized = pipeline.processEvent(rawEvent());
    expect(normalized?.provider).toBe('helius_logs_ws');
  });
});
