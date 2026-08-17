import { describe, it, expect, beforeEach } from 'vitest';
import { marketDataQualityService } from '../quality/quality-service';
import { realtimeMarketPublisher } from '../realtime/realtime-publisher';
import { marketDataCache } from '../cache/market-cache';

describe('Data Quality Scoring & Realtime Publisher (Sprint 45 §55-57, §60-65, §93)', () => {
  beforeEach(() => {
    realtimeMarketPublisher.reset();
    marketDataCache.clear();
  });

  it('evaluates data quality score and data confidence for verified tokens', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const report = marketDataQualityService.evaluateTokenQuality(sentMint);

    expect(report.dataQualityScore).toBeGreaterThan(80);
    expect(report.dataConfidence).toBeGreaterThan(0.8);
    expect(report.divergenceStatus).toBe('NORMAL');
  });

  it('realtime publisher manages subscriptions, coalescing, and reconnection snapshot recovery', async () => {
    let receivedUpdate: any = null;
    const sentMint = 'So11111111111111111111111111111111111111112';

    const unsubscribe = realtimeMarketPublisher.subscribe(
      `token.market_data_updated:${sentMint}`,
      (data) => {
        receivedUpdate = data;
      }
    );

    realtimeMarketPublisher.publishTokenUpdate(sentMint, { priceUsd: 152.5 });

    // Wait for 250ms coalescing window to flush
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedUpdate).toBeDefined();
    expect(receivedUpdate.priceUsd).toBe(152.5);

    // Test snapshot recovery
    const recovered = realtimeMarketPublisher.recoverSnapshot('TOKEN', sentMint);
    expect(recovered.tokenId).toBe(sentMint);

    unsubscribe();
  });

  it('market data cache stores values with TTL and supports invalidation', () => {
    marketDataCache.set('test_price_key', 150.0, 1000);
    expect(marketDataCache.get('test_price_key')).toBe(150.0);

    marketDataCache.invalidate('test_price_key');
    expect(marketDataCache.get('test_price_key')).toBeUndefined();
  });
});
