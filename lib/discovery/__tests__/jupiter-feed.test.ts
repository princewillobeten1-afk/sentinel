import { describe, it, expect, vi } from 'vitest';
import {
  fetchJupiterFeed,
  isOnBondingCurve,
  collapseDuplicateLaunches,
  mapJupiterToken,
  launchedAt,
  formatAge,
  type JupiterToken,
} from '../jupiter-feed';

describe('recent launch host failover', () => {
  it('uses the public API host for live New Pairs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: MINT }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(await fetchJupiterFeed('recent', { limit: 30 })).toEqual([{ id: MINT }]);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.jup.ag/tokens/v2/recent?limit=30');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('tries the lite host if the public API host is quota-limited', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: MINT }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      expect(await fetchJupiterFeed('recent')).toEqual([{ id: MINT }]);
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        'https://api.jup.ag/tokens/v2/recent?limit=30',
        'https://lite-api.jup.ag/tokens/v2/recent?limit=30',
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

const MINT = '7W3zhfDKKfQSJjzs8tqiN8EPyQf8YXP51pTkuGiXpump';
const POOL = 'Ray1poo1AddressDistinctFromTheMint11111111';

const token = (over: Partial<JupiterToken> = {}): JupiterToken => ({
  id: MINT,
  name: 'Test Token',
  symbol: 'TEST',
  launchpad: 'pump.fun',
  usdPrice: 0.0001,
  mcap: 2831,
  liquidity: 2936,
  firstPool: { id: MINT, createdAt: new Date().toISOString() },
  ...over,
});

describe('isOnBondingCurve — graduation is the signal, not firstPool', () => {
  it('does not present the mint itself as a confirmed liquidity pool', () => {
    expect(mapJupiterToken(token()).liquidityPoolAddress).toBeUndefined();
    expect(mapJupiterToken(token({ graduatedPool: POOL })).liquidityPoolAddress).toBe(POOL);
  });
  it('treats a launchpad token with no graduation record as on the curve', () => {
    expect(isOnBondingCurve(token())).toBe(true);
  });

  it('treats a token with graduatedAt as graduated', () => {
    expect(isOnBondingCurve(token({ graduatedAt: '2024-10-18T06:09:47Z' }))).toBe(false);
    expect(isOnBondingCurve(token({ graduatedPool: 'Bzc9NZfMqkXR6fz1DBph' }))).toBe(false);
  });

  it('does NOT use firstPool.id to decide', () => {
    // The regression this pins. `firstPool.id === mint` was used as the
    // graduation test on the reasoning that a pump.fun token's first "pool" is
    // its curve account. It is — and that record persists after graduation:
    // Fartcoin migrated in October 2024 and still reports firstPool.id === mint
    // at a $214M market cap. Checked across 100 tokens, the two tests disagreed
    // on 91.
    const graduatedButFirstPoolIsMint = token({
      firstPool: { id: MINT },
      graduatedAt: '2024-10-18T06:09:47Z',
      mcap: 214_000_000,
    });
    expect(isOnBondingCurve(graduatedButFirstPoolIsMint)).toBe(false);
  });

  it('treats a token with no launchpad as never having had a curve', () => {
    // cbBTC, JLP and similar list straight onto a DEX. They are neither
    // bonding nor graduated, and belong in neither lifecycle column.
    expect(isOnBondingCurve(token({ launchpad: undefined, id: 'SomeDexListedMint11111111' }))).toBe(false);
  });

  it('does not use market cap to decide', () => {
    // A high cap while still on the curve is possible; the curve state decides.
    expect(isOnBondingCurve(token({ mcap: 250_000 }))).toBe(true);
    expect(isOnBondingCurve(token({ mcap: 10, graduatedAt: '2025-01-01T00:00:00Z' }))).toBe(false);
  });

  it('maps bondingStatus from the same test', () => {
    expect(mapJupiterToken(token()).bondingStatus).toBe('bonding');
    expect(mapJupiterToken(token({ graduatedAt: '2025-01-01T00:00:00Z' })).bondingStatus).toBe('graduated');
  });
});

describe('mapJupiterToken — unknown stays unknown', () => {
  it('omits holder fields when Jupiter did not supply them', () => {
    // These were previously `Math.floor(65 + rankIdx * 28)` — a holder count
    // derived from the token's position in the response.
    const mapped = mapJupiterToken(token());
    expect(mapped.holdersCount).toBeUndefined();
    expect(mapped.holderGrowth1hPct).toBeUndefined();
  });

  it('uses the real holder count and change when present', () => {
    const mapped = mapJupiterToken(
      token({ holderCount: 134_759, stats1h: { holderChange: 0.54 } }),
    );
    expect(mapped.holdersCount).toBe(134_759);
    expect(mapped.holderGrowth1hPct).toBe(0.5);
  });

  it('leaves authority flags undefined rather than asserting they are safe', () => {
    // The old mapping hardcoded `isMintRenounced: true` and
    // `isFreezeDisabled: true` for every token — a safety claim about tokens
    // it had never checked.
    const unaudited = mapJupiterToken(token());
    expect(unaudited.isMintRenounced).toBeUndefined();
    expect(unaudited.isFreezeDisabled).toBeUndefined();

    const audited = mapJupiterToken(
      token({ audit: { mintAuthorityDisabled: true, freezeAuthorityDisabled: false } }),
    );
    expect(audited.isMintRenounced).toBe(true);
    expect(audited.isFreezeDisabled).toBe(false);
  });

  it('carries no invented concentration or signal metrics', () => {
    const mapped = mapJupiterToken(token());
    for (const field of [
      'devHoldingsPct',
      'top10HoldingsPct',
      'insiderHoldingsPct',
      'sniperPercentage',
      'bundlerPercentage',
      'riskScore',
      'aiSignalScore',
      'smartMoneyCount',
      'smartMoneyNetFlowUsd',
    ] as const) {
      expect(mapped[field]).toBeUndefined();
    }
  });
});

describe('mapJupiterToken — real trade stats', () => {
  it('derives buy pressure from actual counts', () => {
    const mapped = mapJupiterToken(token({ stats1h: { numBuys: 3, numSells: 1 } }));
    expect(mapped.buysCount).toBe(3);
    expect(mapped.sellsCount).toBe(1);
    expect(mapped.buyPressureRatio).toBe(0.75);
    expect(mapped.buySellImbalancePct).toBe(50);
  });

  it('keeps pressure unknown when the provider omitted both counts', () => {
    const mapped = mapJupiterToken(token({ stats1h: {} }));
    expect(Number.isNaN(mapped.buyPressureRatio)).toBe(true);
    expect(Number.isNaN(mapped.buySellImbalancePct)).toBe(true);
  });

  it('preserves a measured zero when the provider reported zero trades', () => {
    const mapped = mapJupiterToken(token({ stats1h: { numBuys: 0, numSells: 0 } }));
    expect(mapped.buyPressureRatio).toBe(0);
    expect(mapped.buySellImbalancePct).toBe(0);
  });

  it('sums both sides for window volume', () => {
    const mapped = mapJupiterToken(token({ stats5m: { buyVolume: 98.7, sellVolume: 5.05 } }));
    expect(Number(mapped.volume5mUsd)).toBeCloseTo(103.75, 2);
  });

  it('falls back to fdv when mcap is absent, not to a made-up figure', () => {
    expect(mapJupiterToken(token({ mcap: undefined, fdv: 5000 })).marketCapUsd).toBe('5000');
    expect(mapJupiterToken(token({ mcap: undefined, fdv: undefined })).marketCapUsd).toBe('');
  });
});

describe('launch time and age', () => {
  it('prefers the pool creation time', () => {
    const poolTime = '2026-08-24T09:43:07Z';
    expect(launchedAt(token({ firstPool: { id: MINT, createdAt: poolTime }, createdAt: '2020-01-01T00:00:00Z' })))
      .toBe(Date.parse(poolTime));
  });

  it('returns null for an unparseable timestamp instead of Date.now()', () => {
    // Defaulting to now would make every undated token look brand new and
    // float to the top of the New column.
    expect(launchedAt(token({ firstPool: { id: MINT, createdAt: 'not-a-date' }, createdAt: undefined }))).toBeNull();
  });

  it('formats ages the way the column reads them', () => {
    expect(formatAge(0.5)).toBe('30s ago');
    expect(formatAge(9)).toBe('9m ago');
    expect(formatAge(120)).toBe('2h ago');
  });
});

describe('source attribution', () => {
  it('reads the launchpad when present', () => {
    expect(mapJupiterToken(token({ launchpad: 'pump.fun' })).source).toBe('Pump.fun');
    expect(mapJupiterToken(token({ launchpad: 'Meteora' })).source).toBe('Meteora');
  });

  it('falls back to the pump mint suffix', () => {
    expect(mapJupiterToken(token({ launchpad: undefined })).source).toBe('Pump.fun');
  });
});

describe('collapseDuplicateLaunches', () => {
  const tok = (over: Partial<import('../types').DiscoveryToken>) =>
    mapJupiterToken(token({ id: (over.mint as string) ?? MINT })) &&
    ({ ...mapJupiterToken(token()), ...over } as import('../types').DiscoveryToken);

  it('folds identical name+symbol launches into one row with a count', () => {
    // Measured on a live response: 30 rows, 19 distinct names, one repeated 10x.
    const rows = [
      tok({ mint: 'a', name: 'SEND TICKERS', symbol: 'SEND', liquidityUsd: '100' }),
      tok({ mint: 'b', name: 'SEND TICKERS', symbol: 'SEND', liquidityUsd: '900' }),
      tok({ mint: 'c', name: 'SEND TICKERS', symbol: 'SEND', liquidityUsd: '50' }),
      tok({ mint: 'd', name: 'Other', symbol: 'OTH', liquidityUsd: '10' }),
    ];
    const out = collapseDuplicateLaunches(rows);
    expect(out).toHaveLength(2);
    const send = out.find((t) => t.symbol === 'SEND')!;
    expect(send.duplicateCount).toBe(3);
    // Keeps the tradable one.
    expect(send.mint).toBe('b');
  });

  it('drops zero-liquidity rows by default', () => {
    // A token with no pool cannot be traded, so it is not a discovery.
    const rows = [
      tok({ mint: 'a', name: 'Live', symbol: 'LIVE', liquidityUsd: '500' }),
      tok({ mint: 'b', name: 'Dead', symbol: 'DEAD', liquidityUsd: '0' }),
    ];
    expect(collapseDuplicateLaunches(rows).map((t) => t.symbol)).toEqual(['LIVE']);
  });

  it('can include zero-liquidity rows when asked', () => {
    const rows = [tok({ mint: 'b', name: 'Dead', symbol: 'DEAD', liquidityUsd: '0' })];
    expect(collapseDuplicateLaunches(rows, { includeZeroLiquidity: true })).toHaveLength(1);
  });

  it('marks a unique launch with a count of 1, not undefined', () => {
    const rows = [tok({ mint: 'a', name: 'Solo', symbol: 'SOLO', liquidityUsd: '10' })];
    expect(collapseDuplicateLaunches(rows)[0].duplicateCount).toBe(1);
  });

  it('treats a shared symbol with a different name as distinct', () => {
    const rows = [
      tok({ mint: 'a', name: 'Alpha', symbol: 'X', liquidityUsd: '10' }),
      tok({ mint: 'b', name: 'Beta', symbol: 'X', liquidityUsd: '10' }),
    ];
    expect(collapseDuplicateLaunches(rows)).toHaveLength(2);
  });
});

describe('creator facts — carried from Jupiter, not derived', () => {
  it('maps devBalancePercentage as a percentage, not a fraction', () => {
    // Jupiter publishes this already scaled 0-100: observed 11.4964 for a dev
    // holding 11.5% of supply. Dividing by 100 here would report 0.11%.
    const mapped = mapJupiterToken(token({ audit: { devBalancePercentage: 11.4964285714286 } }));
    expect(mapped?.devHoldingsPct).toBe(11.5);
  });

  it('leaves dev holdings undefined when Jupiter omits it', () => {
    // Absent means "dev holds nothing to report", which is not the same claim
    // as 0% and must not render as a measured zero.
    const mapped = mapJupiterToken(token({ audit: { mintAuthorityDisabled: true } }));
    expect(mapped?.devHoldingsPct).toBeUndefined();
  });

  it('carries both halves of the creator track record', () => {
    // The card renders these as one fraction (350/19796). Either number alone
    // says little; together they state the hit rate.
    const mapped = mapJupiterToken(token({ audit: { devMints: 19796, devMigrations: 350 } }));
    expect(mapped?.devMints).toBe(19796);
    expect(mapped?.devMigrations).toBe(350);
  });

  it('does not invent a track record for a first-time deployer', () => {
    const mapped = mapJupiterToken(token({ dev: 'Dev1111111111111111111111111111111111111111' }));
    expect(mapped?.devMints).toBeUndefined();
    expect(mapped?.devMigrations).toBeUndefined();
    expect(mapped?.devAddress).toBe('Dev1111111111111111111111111111111111111111');
  });

  it('never fabricates holder concentration', () => {
    // top10 needs getTokenLargestAccounts, which no free RPC serves. It stays
    // undefined here so the card shows "not measured" rather than a number.
    const mapped = mapJupiterToken(token({ holderCount: 190 }));
    expect(mapped?.holdersCount).toBe(190);
    expect(mapped?.top10HoldingsPct).toBeUndefined();
    expect(mapped?.sniperPercentage).toBeUndefined();
    expect(mapped?.bundlerPercentage).toBeUndefined();
  });
});
