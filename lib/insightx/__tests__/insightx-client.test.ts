import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getInsightXAtlasEmbedUrl,
  isInsightXScannerSupported,
  isInsightXSolanaMetricsSupported,
  toInsightXNetwork,
} from '../atlas-embed';
import {
  buildInsightXLabelMap,
  fetchInsightXClusters,
  fetchInsightXDistribution,
  fetchInsightXLabels,
  fetchInsightXOwnershipProfile,
  fetchInsightXTokenIntelligence,
  isInsightXConfigured,
  lookupInsightXLabel,
  normalizeDistributionMetrics,
  normalizeDistributionPct,
  resetInsightXClientStateForTests,
} from '../client';
import { formatDisplaySource } from '@/lib/discovery/format';

describe('InsightX integration', () => {
  const originalKey = process.env.INSIGHTX_API_KEY;
  const originalBase = process.env.INSIGHTX_API_BASE_URL;
  const originalEmbedId = process.env.NEXT_PUBLIC_INSIGHTX_EMBED_ID;

  beforeEach(() => {
    resetInsightXClientStateForTests();
    delete process.env.INSIGHTX_API_KEY;
    delete process.env.INSIGHTX_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_INSIGHTX_EMBED_ID;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetInsightXClientStateForTests();
    if (originalKey === undefined) delete process.env.INSIGHTX_API_KEY;
    else process.env.INSIGHTX_API_KEY = originalKey;

    if (originalBase === undefined) delete process.env.INSIGHTX_API_BASE_URL;
    else process.env.INSIGHTX_API_BASE_URL = originalBase;

    if (originalEmbedId === undefined) delete process.env.NEXT_PUBLIC_INSIGHTX_EMBED_ID;
    else process.env.NEXT_PUBLIC_INSIGHTX_EMBED_ID = originalEmbedId;
  });

  it('maps chain identifiers and capabilities accurately', () => {
    expect(toInsightXNetwork('solana')).toBe('sol');
    expect(toInsightXNetwork('SOL')).toBe('sol');
    expect(toInsightXNetwork('robinhood')).toBe('robinhood');
    expect(toInsightXNetwork('4663')).toBe('robinhood');
    expect(toInsightXNetwork('ethereum')).toBe('eth');

    expect(isInsightXScannerSupported('solana')).toBe(true);
    expect(isInsightXScannerSupported('eth')).toBe(true);
    expect(isInsightXScannerSupported('robinhood')).toBe(false);

    expect(isInsightXSolanaMetricsSupported('solana')).toBe(true);
    expect(isInsightXSolanaMetricsSupported('robinhood')).toBe(false);
  });

  it('builds Atlas Live embed URLs for Solana and Robinhood', () => {
    expect(
      getInsightXAtlasEmbedUrl('solana', 'So11111111111111111111111111111111111111112'),
    ).toBe('https://embed.insightx.network/atlas/sol/So11111111111111111111111111111111111111112');

    expect(
      getInsightXAtlasEmbedUrl('robinhood', '0x4200000000000000000000000000000000000006', {
        embedId: 'sentinel-prod-id',
        preview: true,
      }),
    ).toBe(
      'https://embed.insightx.network/atlas/robinhood/0x4200000000000000000000000000000000000006?embed_id=sentinel-prod-id&preview=true',
    );

    expect(getInsightXAtlasEmbedUrl('solana', '   ')).toBeNull();
  });

  it('normalizes 0-1 and 0-100 top_10_holder_concentration schemas', () => {
    expect(normalizeDistributionPct(0.42)).toBe(42);
    expect(normalizeDistributionPct(42.5)).toBe(42.5);
    expect(normalizeDistributionPct(0)).toBe(0);
    expect(normalizeDistributionPct(1, 98.4)).toBe(100);
    expect(normalizeDistributionPct(1, 1.1)).toBe(1);

    const normalized = normalizeDistributionMetrics({
      gini: 0.78,
      hhi: 0.14,
      nakamoto: 4,
      top_10_holder_concentration: 0.375,
    });
    expect(normalized).toEqual({
      gini: 0.78,
      hhi: 0.14,
      nakamoto: 4,
      top10Pct: 37.5,
    });
  });

  it('returns configured: false with valid atlasEmbedUrl when INSIGHTX_API_KEY is unset', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(isInsightXConfigured()).toBe(false);

    const intel = await fetchInsightXTokenIntelligence(
      'solana',
      'So11111111111111111111111111111111111111112',
    );

    expect(intel.configured).toBe(false);
    expect(intel.network).toBe('sol');
    expect(intel.atlasEmbedUrl).toBe(
      'https://embed.insightx.network/atlas/sol/So11111111111111111111111111111111111111112',
    );
    expect(intel.metrics).toBeNull();
    expect(intel.clusters).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches full Solana intelligence with X-API-Key and filters benign cluster tags', async () => {
    process.env.INSIGHTX_API_KEY = 'test-insightx-uuid';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(headers.get('X-API-Key')).toBe('test-insightx-uuid');

      const respHeaders = {
        'content-type': 'application/json',
        'X-RateLimit-Minute-Remaining': '58',
        'X-Quota-Month-Remaining': '9940',
      };

      if (url.includes('/distribution')) {
        return new Response(
          JSON.stringify({ gini: 0.81, hhi: 0.19, nakamoto: 3, top_10_holder_concentration: 0.45 }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/clusters')) {
        return new Response(
          JSON.stringify({
            total_cluster_pct: 18.4,
            clusters: [
              {
                pct: 12.2,
                tags: ['funding_address', 'wallet'],
                cluster_addresses: [
                  { address: 'WalletA', balance: 1000, percentage: 6.1, tags: ['funding_address'] },
                  { address: 'WalletB', balance: 1000, percentage: 6.1, tags: ['wallet'] },
                ],
              },
              {
                pct: 6.2,
                tags: ['liquidity_pool'],
                cluster_addresses: [
                  { address: 'Pool1', balance: 2000, percentage: 6.2, tags: ['liquidity_pool'] },
                ],
              },
            ],
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/snipers')) {
        return new Response(
          JSON.stringify({
            total_sniper_pct: 3.5,
            count: { total: 2, sold_partially: 1, sold_fully: 0, bought_more: 1 },
            snipers: [{ address: 'Sniper1', balance: 500, percentage: 3.5 }],
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/bundlers')) {
        return new Response(
          JSON.stringify({
            total_bundlers_pct: 4.1,
            bundlers: [{ address: 'Bundler1', balance: 600, percentage: 4.1, slot: 123 }],
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/insiders')) {
        return new Response(
          JSON.stringify({
            total_insiders_pct: 2.0,
            insiders: [{ address: 'Insider1', balance: 300, percentage: 2.0 }],
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/dex-metrics/v1/sol/')) {
        return new Response(
          JSON.stringify({
            cluster_pct: 18.4,
            snipers_pct: 3.5,
            bundlers_pct: 4.1,
            dev_pct: 1.2,
            insiders_pct: 2.0,
            top10_pct: 45.0,
          }),
          { status: 200, headers: respHeaders },
        );
      }
      if (url.includes('/scanner/v1/tokens/sol/')) {
        return new Response(
          JSON.stringify({
            network: 'sol',
            token: 'Mint111',
            results: { simple: { score: 86, message: 'Low risk', reasons: [] } },
          }),
          { status: 200, headers: respHeaders },
        );
      }
      return new Response('Not found', { status: 404 });
    });

    // Default 'core' mode only invokes DEX Metrics + Clusters (2 requests)
    const coreIntel = await fetchInsightXTokenIntelligence('solana', 'MintCore');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(coreIntel.detailLevel).toBe('core');
    expect(coreIntel.metrics?.cluster_pct).toBe(18.4);
    expect(coreIntel.clusters?.clusterCount).toBe(2);
    expect(coreIntel.distribution).toBeNull();
    expect(coreIntel.scanner).toBeNull();

    fetchMock.mockClear();

    const intel = await fetchInsightXTokenIntelligence('solana', 'Mint111', { mode: 'full' });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(intel.configured).toBe(true);
    expect(intel.detailLevel).toBe('full');
    expect(intel.metrics?.cluster_pct).toBe(18.4);
    expect(intel.distribution?.top10Pct).toBe(45);
    expect(intel.clusters?.clusterCount).toBe(2);
    expect(intel.clusters?.suspiciousClusterCount).toBe(1);
    expect(intel.clusters?.clusteredAddressCount).toBe(3);
    expect(intel.snipers?.count.total).toBe(2);
    expect(intel.bundlers?.total_bundlers_pct).toBe(4.1);
    expect(intel.insiders?.total_insiders_pct).toBe(2.0);
    expect(intel.scanner?.results?.simple?.score).toBe(86);
    expect(intel.rateLimit).toEqual({
      minuteRemaining: 58,
      monthRemaining: 9940,
      coolingDown: false,
    });
  });

  it('skips Solana-only endpoints on Robinhood Chain and maps ownership profiles safely', async () => {
    process.env.INSIGHTX_API_KEY = 'test-rh-key';

    const calledUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      calledUrls.push(url);

      if (url.endsWith('/dex-metrics/v1/robinhood/0xAbC')) {
        return new Response(
          JSON.stringify({
            cluster_pct: 11.5,
            snipers_pct: 0,
            bundlers_pct: 0,
            dev_pct: 0,
            insiders_pct: 0,
            top10_pct: 52.3,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/dex-metrics/v1/robinhood/0xAbC/distribution')) {
        return new Response(
          JSON.stringify({ gini: 0.72, hhi: 0.16, nakamoto: 5, top_10_holder_concentration: 52.3 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/dex-metrics/v1/robinhood/0xAbC/clusters')) {
        return new Response(
          JSON.stringify({ total_cluster_pct: 11.5, clusters: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const intel = await fetchInsightXTokenIntelligence('robinhood', '0xAbC', { mode: 'full' });
    expect(calledUrls.some((u) => u.includes('/snipers'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/bundlers'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('/scanner'))).toBe(false);
    expect(intel.capabilities.snipersAndBundlers).toBe(false);
    expect(intel.capabilities.scanner).toBe(false);

    const rhProfile = await fetchInsightXOwnershipProfile('robinhood', '0xAbC');
    expect(rhProfile?.source).toBe('insightx');
    expect(rhProfile?.top10Pct).toBe(52.3);
    expect(rhProfile?.snipersPct).toBeNull();
    expect(rhProfile?.bundlersPct).toBeNull();
  });

  it('batches labels requests at 100 addresses per call and resolves EVM case-insensitively', async () => {
    process.env.INSIGHTX_API_KEY = 'test-labels-key';
    const addresses = Array.from({ length: 120 }, (_, i) => `0x0000000000000000000000000000000000000${String(i).padStart(3, '0')}`);

    const batchSizes: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const segment = url.split('/labels/v1/robinhood/')[1] ?? '';
      const batch = segment.split(',');
      batchSizes.push(batch.length);
      return new Response(
        JSON.stringify([{ address: batch[0].toLowerCase(), label: 'Treasury Multisig', tags: ['team'] }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const labels = await fetchInsightXLabels('robinhood', addresses);
    expect(batchSizes).toEqual([100, 20]);
    expect(labels).toHaveLength(2);

    const map = buildInsightXLabelMap(labels, 'robinhood');
    expect(lookupInsightXLabel(map, addresses[0].toUpperCase(), 'robinhood')?.label).toBe('Treasury Multisig');
  });

  it('applies cooldown on 401 and 429 responses while serving cached data, and formats attribution labels', async () => {
    process.env.INSIGHTX_API_KEY = 'bad-key';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    expect(await fetchInsightXClusters('solana', 'MintA')).toBeNull();
    // Second call while auth cooldown active should not invoke fetch again.
    expect(await fetchInsightXDistribution('solana', 'MintA')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();

    resetInsightXClientStateForTests();
    process.env.INSIGHTX_API_KEY = 'rate-limited-key';
    const fetch429Spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total_cluster_pct: 5, clusters: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('Too many requests', { status: 429, headers: { 'Retry-After': '10' } }),
      );
    const cachedClusters = await fetchInsightXClusters('solana', 'MintCached');
    expect(cachedClusters?.totalClusterPct).toBe(5);

    expect(await fetchInsightXClusters('solana', 'MintB')).toBeNull();
    expect(await fetchInsightXClusters('solana', 'MintC')).toBeNull();
    // Cached entries continue serving during 429 cooldown without invoking fetch.
    expect((await fetchInsightXClusters('solana', 'MintCached'))?.totalClusterPct).toBe(5);
    expect(fetch429Spy).toHaveBeenCalledTimes(2);

    expect(formatDisplaySource('insightx+rugcheck')).toBe('Cluster graph + Security audit');
  });
});
