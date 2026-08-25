import { describe, it, expect } from 'vitest';
import {
  isOnBondingCurve,
  collapseDuplicateLaunches,
  mapJupiterToken,
  launchedAt,
  formatAge,
  type JupiterToken,
} from '../jupiter-feed';

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

describe('isOnBondingCurve', () => {
  it('treats a pool id equal to the mint as still bonding', () => {
    // pump.fun's pre-graduation "pool" is the bonding curve account, which
    // Jupiter reports under the mint's own id.
    expect(isOnBondingCurve(token())).toBe(true);
  });

  it('treats a distinct pool id as migrated', () => {
    expect(isOnBondingCurve(token({ firstPool: { id: POOL } }))).toBe(false);
  });

  it('treats a missing pool as not yet migrated', () => {
    // A migrated token always has a pool distinct from its mint, so absence
    // cannot mean graduated.
    expect(isOnBondingCurve(token({ firstPool: undefined }))).toBe(true);
  });

  it('does not use market cap to decide', () => {
    // The previous implementation inferred this from `mcap / 69000`, which
    // misclassifies any token whose price moves between the curve completing
    // and the pool appearing. A high-cap token still on its curve must still
    // read as bonding.
    expect(isOnBondingCurve(token({ mcap: 250_000 }))).toBe(true);
    expect(isOnBondingCurve(token({ mcap: 10, firstPool: { id: POOL } }))).toBe(false);
  });

  it('maps bondingStatus from the same structural test', () => {
    expect(mapJupiterToken(token()).bondingStatus).toBe('bonding');
    expect(mapJupiterToken(token({ firstPool: { id: POOL } })).bondingStatus).toBe('graduated');
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

  it('reports zero pressure rather than NaN when nothing traded', () => {
    const mapped = mapJupiterToken(token({ stats1h: {} }));
    expect(mapped.buyPressureRatio).toBe(0);
    expect(mapped.buySellImbalancePct).toBe(0);
    expect(Number.isNaN(mapped.buyPressureRatio)).toBe(false);
  });

  it('sums both sides for window volume', () => {
    const mapped = mapJupiterToken(token({ stats5m: { buyVolume: 98.7, sellVolume: 5.05 } }));
    expect(Number(mapped.volume5mUsd)).toBeCloseTo(103.75, 2);
  });

  it('falls back to fdv when mcap is absent, not to a made-up figure', () => {
    expect(mapJupiterToken(token({ mcap: undefined, fdv: 5000 })).marketCapUsd).toBe('5000');
    expect(mapJupiterToken(token({ mcap: undefined, fdv: undefined })).marketCapUsd).toBe('0');
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
