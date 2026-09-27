import { describe, expect, it } from 'vitest';
import { publicChartFrame, publicChartSnapshot, publicData, publicMessage } from '../public-data';
import { publicAssetUrl, resolvePublicAsset } from '../public-assets';
import { parsePublicChartFrame, parsePublicChartSnapshot } from '@/lib/market/public-chart';
import type { ChartSnapshot } from '@/lib/market/chart-model';

const address = 'So11111111111111111111111111111111111111112';
const snapshot: ChartSnapshot = { address, chain: 'solana', timeframe: '1m', currency: 'usd',
  market: 'token-aggregate', candles: [{ time: 60, open: 1, high: 3, low: .5, close: 2, volume: null, volumeUsd: 0 }],
  hasMore: true, oldestTime: 60, observedAt: 1000, source: 'birdeye-ohlcv-v3', status: 'measured' };
describe('public data boundary', () => {
  it('projects snapshots without changing the internal evidence', () => {
    const original = structuredClone(snapshot);
    const result = publicChartSnapshot(snapshot);
    expect(result).not.toHaveProperty('source');
    expect(JSON.stringify(result)).not.toMatch(/birdeye|helius|quicknode|rugcheck/i);
    expect(parsePublicChartSnapshot(result, address, '1m')).toEqual(result);
    expect(snapshot).toEqual(original);
  });
  it('keeps identical series identity across REST and streaming without losing delivery semantics', () => {
    const stream = publicChartFrame({ address, timeframe: '1m', candle: snapshot.candles[0], observedAt: 1000, source: 'birdeye-price-ws' });
    expect(stream.seriesId).toBe(publicChartSnapshot(snapshot).seriesId);
    expect(stream.deliveryMode).toBe('stream');
    expect(parsePublicChartFrame(stream)).toEqual(stream);
    const poll = publicChartFrame({ address, timeframe: '1m', candle: snapshot.candles[0], observedAt: 1000, source: 'birdeye-ohlcv-rest' });
    expect(poll.deliveryMode).toBe('poll');
    const pool = publicChartFrame({ address, timeframe: '1m', candle: snapshot.candles[0], observedAt: 1000,
      source: 'quicknode-pool-ws', market: 'pool', poolAddress: address, provisional: true });
    expect(pool.seriesId).not.toBe(stream.seriesId);
    expect(pool.priority).toBeLessThan(stream.priority);
    expect(pool.provisional).toBe(true);
  });
  it('covers nested evidence, replay and diagnostics without rewriting token names or transaction bytes', () => {
    const input = { snapshot: true, source: 'rugcheck', changedFields: { name: 'Jupiter', symbol: 'JUP',
      source: 'Pump.fun', ownershipEvidence: { status: 'measured', source: 'birdeye-holder', observedAt: '2026-09-27',
        reason: 'Birdeye quota exhausted' }, rawResponse: { key: 'secret' }, fieldSources: { dev: 'rugcheck' } },
      transactionBase64: 'birdeye-THIS-IS-TRANSACTION-CONTENT', signature: 'real-signature', dex: 'Raydium' };
    const result = publicData(input) as any;
    expect(result.source).toBe('Security analysis');
    expect(result.changedFields.name).toBe('Jupiter');
    expect(result.changedFields.source).toBe('Pump.fun');
    expect(result.changedFields.ownershipEvidence).toMatchObject({ source: 'Ownership analysis', status: 'measured' });
    expect(result.changedFields.rawResponse).toBeUndefined();
    expect(result.changedFields.fieldSources).toBeUndefined();
    expect(result.transactionBase64).toBe(input.transactionBase64);
    expect(result.dex).toBe('Raydium');
    expect(input.source).toBe('rugcheck');
  });
  it('replaces upstream explanations, not validation messages', () => {
    expect(publicMessage('Birdeye API key rejected')).not.toMatch(/birdeye|key/i);
    expect(publicMessage('Amount must be positive.')).toBe('Amount must be positive.');
    expect(publicMessage('Request https://secret.example/?key=123 failed')).not.toContain('123');
  });
  it('uses an opaque asset identifier and never accepts arbitrary URLs at the image route', () => {
    const url = 'https://cdn.dexscreener.com/token-images/og/solana/example.png';
    const publicUrl = publicAssetUrl(url)!;
    expect(publicUrl).toMatch(/^\/api\/assets\/[a-f0-9]{64}$/);
    expect(resolvePublicAsset(publicUrl.split('/').pop()!)).toBe(url);
    expect(resolvePublicAsset('https://127.0.0.1/private')).toBeUndefined();
    expect(publicAssetUrl('https://cdn.dexscreener.com/private?apiKey=secret')).toBeUndefined();
    expect(publicAssetUrl('http://cdn.dexscreener.com/image.png')).toBeUndefined();
    expect(publicAssetUrl('https://token.example/logo.png')).toBe('https://token.example/logo.png');
  });
});
