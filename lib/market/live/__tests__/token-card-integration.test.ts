import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBirdeyeSubscriptions, classifyBirdeyeWebSocketError } from '../birdeye-client';
import { normalizeBirdeyeTokenStats } from '../normalizers';
import { __resetTokenCardCache, getTokenCardPatch, hydrateTokenCards, updateTokenCard } from '../card-cache';
import { redis } from '@/lib/server/redis';

describe('Birdeye visible-card subscriptions', () => {
  it('backs off on access and quota rejections without exposing upstream text', () => {
    const access = classifyBirdeyeWebSocketError({ data: 'Origin or API key is invalid: secret-value', statusCode: 400 });
    const quota = classifyBirdeyeWebSocketError({ data: 'Compute units usage limit exceeded', statusCode: 400 });
    expect(access.retryMs).toBe(15 * 60_000);
    expect(access.reason).not.toContain('secret-value');
    expect(quota.reason).toContain('quota');
    expect(classifyBirdeyeWebSocketError({ data: 'Invalid query' }).retryMs).toBe(60_000);
  });

  it('puts every visible mint in each supported multi-token subscription', () => {
    const subscriptions = buildBirdeyeSubscriptions(['MintA', 'MintB', 'MintA']);
    expect(subscriptions).toHaveLength(4);
    const wire = JSON.stringify(subscriptions);
    expect(wire.match(/MintA/g)?.length).toBeGreaterThanOrEqual(3);
    expect(wire.match(/MintB/g)?.length).toBeGreaterThanOrEqual(3);
    expect((subscriptions[2] as any).data.address).toEqual(['MintA', 'MintB']);
    expect((subscriptions[2] as any).data.select.trade_data.intervals).toEqual(['5m', '1h', '24h']);
    expect((subscriptions[2] as any).data.select.holder_data).toBe(true);
    expect((buildBirdeyeSubscriptions(['MintA'], [], false)[2] as any).data.select.holder_data).toBeUndefined();
    expect(subscriptions[3]).toEqual({ type: 'SUBSCRIBE_NEW_PAIR' });
  });

  it('actively unsubscribes when no cards remain visible', () => {
    expect(buildBirdeyeSubscriptions([]).map((message) => message.type)).toEqual([
      'UNSUBSCRIBE_PRICE', 'UNSUBSCRIBE_TXS', 'UNSUBSCRIBE_TOKEN_STATS', 'SUBSCRIBE_NEW_PAIR',
    ]);
  });
});

describe('token stats contract', () => {
  it('keeps missing metrics unknown and preserves a measured zero', () => {
    const parsed = normalizeBirdeyeTokenStats({
      type: 'TOKEN_STATS_DATA',
      data: { address: 'MintA', price: 0.25, buy_1h: 0 },
    });
    expect(parsed?.fields.priceUsd).toBe('0.25');
    expect(parsed?.fields.buysCount).toBe(0);
    expect(parsed?.fields.liquidityUsd).toBeUndefined();
    expect(parsed?.fields.sellsCount).toBeUndefined();
  });

  it('maps the exact five-minute activity window without substituting another window', () => {
    const parsed = normalizeBirdeyeTokenStats({
      type: 'TOKEN_STATS_DATA',
      data: { address: 'MintA', volume_5m_usd: 18, buy_volume_5m_usd: 12, sell_volume_5m_usd: 6, trade_5m: 4, buy_5m: 3, sell_5m: 1 },
    });
    expect(parsed?.hasActivityFields).toBe(true);
    expect(parsed?.fields).toMatchObject({ volume5mUsd: '18', buyVolume5mUsd: 12, sellVolume5mUsd: 6, txCount5m: 4, buysCount5m: 3, sellsCount5m: 1 });
    expect(parsed?.fields.volume1hUsd).toBeUndefined();
  });

  it('accepts the alternate Birdeye token-stats buy/sell volume keys', () => {
    const parsed = normalizeBirdeyeTokenStats({
      type: 'TOKEN_STATS_DATA',
      data: { address: 'MintA', volume_buy_5m_usd: 0, volume_sell_5m_usd: 7 },
    });
    expect(parsed?.fields).toMatchObject({ buyVolume5mUsd: 0, sellVolume5mUsd: 7 });
  });

  it('maps all nine documented holder fields without scaling percentages or confusing counts with total holders', () => {
    const parsed = normalizeBirdeyeTokenStats({
      type: 'TOKEN_STATS_DATA',
      data: { address: 'MintHolder', top10_holder_percentage: 90.748, sniper_count: 3,
        sniper_held_percentage: 0.000049, bundler_count: 115, bundler_held_percentage: 6.0628,
        insider_count: 0, insider_held_percentage: 0, dev_count: 2, dev_held_percentage: 1.5 },
    });
    expect(parsed?.hasOwnershipFields).toBe(true);
    expect(parsed?.hasMarketFields).toBe(false);
    expect(parsed?.hasActivityFields).toBe(false);
    expect(parsed?.fields).toEqual({ top10HoldingsPct: 90.748, sniperCount: 3,
      sniperPercentage: 0.000049, bundlerCount: 115, bundlerPercentage: 6.0628,
      insiderCount: 0, insiderHoldingsPct: 0, devCount: 2, devHoldingsPct: 1.5 });
    expect(parsed?.fields).not.toHaveProperty('holdersCount');
  });

  it('leaves omitted and malformed classifications unknown while retaining valid zero', () => {
    const parsed = normalizeBirdeyeTokenStats({ type: 'TOKEN_STATS_DATA', data: {
      address: 'MintHolder', sniper_count: 0, sniper_held_percentage: 101,
      bundler_count: -1, insider_held_percentage: null as unknown as number,
      dev_count: 2.5,
    } });
    expect(parsed?.fields).toEqual({ sniperCount: 0 });
    expect(parsed?.fields.top10HoldingsPct).toBeUndefined();
    expect(normalizeBirdeyeTokenStats({ type: 'TOKEN_STATS_DATA', data: { address: 'MintHolder' } })).toBeNull();
  });
});

describe('token card ordering', () => {
  beforeEach(() => __resetTokenCardCache());

  it('does not let an older provider frame overwrite newer fields', () => {
    updateTokenCard('MintA', { priceUsd: '2', top10HoldingsPct: 30 }, 'new', 'fresh', '2026-09-11T10:00:00.000Z');
    updateTokenCard('MintA', { priceUsd: '1', top10HoldingsPct: 10 }, 'old', 'fresh', '2026-09-11T09:59:00.000Z');
    expect(getTokenCardPatch('MintA')?.changedFields.priceUsd).toBe('2');
    expect(getTokenCardPatch('MintA')?.changedFields.top10HoldingsPct).toBe(30);
    expect(getTokenCardPatch('MintA')?.fieldSources?.priceUsd).toBe('new');
  });

  it('accepts an older observation for a field that has never been seen', () => {
    updateTokenCard('MintA', { priceUsd: '2' }, 'market', 'fresh', '2026-09-11T10:00:00.000Z');
    updateTokenCard('MintA', { sniperPercentage: 0 }, 'ownership', 'fresh', '2026-09-11T09:59:00.000Z');
    expect(getTokenCardPatch('MintA')?.changedFields.sniperPercentage).toBe(0);
  });

  it('keeps measured stream ownership when a later REST request fails', () => {
    const measured = { status: 'measured' as const, source: 'birdeye-token-stats-ws', observedAt: '2026-09-25T10:00:00.000Z' };
    updateTokenCard('MintHolder', { sniperPercentage: 0, sniperCount: 0, ownershipEvidence: measured },
      'birdeye-token-stats-ws', 'fresh', measured.observedAt);
    updateTokenCard('MintHolder', { auditPending: false, ownershipEvidence: {
      status: 'unavailable', source: 'birdeye-holder-profile', observedAt: '2026-09-25T10:00:05.000Z',
    } }, 'birdeye-holder-profile', 'stale', '2026-09-25T10:00:05.000Z');
    expect(getTokenCardPatch('MintHolder')?.changedFields).toMatchObject({
      sniperPercentage: 0, sniperCount: 0, auditPending: false, ownershipEvidence: measured,
    });
  });

  it('rejects malformed observation times', () => {
    updateTokenCard('MintA', { priceUsd: '2' }, 'market', 'fresh', '2026-09-11T10:00:00.000Z');
    updateTokenCard('MintA', { priceUsd: '1' }, 'broken', 'fresh', 'not-a-time');
    expect(getTokenCardPatch('MintA')?.changedFields.priceUsd).toBe('2');
  });

  it('restores individual field times and marks replayed evidence stale', async () => {
    updateTokenCard('MintA', { sniperPercentage: 8, ownershipEvidence: {
      status: 'measured', source: 'holder-profile', observedAt: '2026-09-11T09:00:00.000Z',
    } }, 'ownership', 'fresh', '2026-09-11T09:00:00.000Z');
    updateTokenCard('MintA', { priceUsd: '2' }, 'market', 'fresh', '2026-09-11T10:00:00.000Z');
    const saved = JSON.stringify(getTokenCardPatch('MintA'));
    __resetTokenCardCache();
    const read = vi.spyOn(redis, 'get').mockResolvedValue(saved);
    try {
      await hydrateTokenCards(['MintA']);
      expect(getTokenCardPatch('MintA')?.changedFields.ownershipEvidence?.status).toBe('stale');
      updateTokenCard('MintA', { sniperPercentage: 5 }, 'ownership', 'fresh', '2026-09-11T09:30:00.000Z');
      expect(getTokenCardPatch('MintA')?.changedFields.sniperPercentage).toBe(5);
      expect(getTokenCardPatch('MintA')?.changedFields.priceUsd).toBe('2');
      expect(getTokenCardPatch('MintA')?.fieldSources?.priceUsd).toBe('market');
      expect(getTokenCardPatch('MintA')?.fieldSources?.sniperPercentage).toBe('ownership');
    } finally { read.mockRestore(); }
  });
});
