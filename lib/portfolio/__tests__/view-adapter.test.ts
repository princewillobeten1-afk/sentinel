import { describe, expect, it } from 'vitest';
import { adaptPortfolioSummary, adaptPosition } from '../view-adapter';
import type { MonetaryValue, PortfolioOverview, Position, RiskBand } from '../types';

const known = (value: number | null): MonetaryValue => ({
  status: value === null ? 'UNKNOWN' : 'KNOWN',
  usd: value,
  confidence: value === null ? 0 : 1,
});

function overview(patch: Partial<PortfolioOverview> = {}): PortfolioOverview {
  return {
    portfolioId: 'p1',
    wallets: ['wallet-1'],
    chains: ['SOLANA'],
    totalValue: known(1000),
    estimatedExitValue: known(950),
    stressExitValue: known(900),
    availableBalance: known(100),
    investedCapital: known(800),
    realizedPnl: known(50),
    unrealizedPnl: known(150),
    netPnl: known(190),
    fees: { tradingFeesUsd: 5, networkFeesUsd: 3, dexFeesUsd: 2, totalUsd: 10 },
    todayChange: known(20),
    todayChangePct: 0.02,
    positionCount: 2,
    openPositionCount: 2,
    highRiskPositionCount: 0,
    exitabilityIssueCount: 0,
    pendingCount: 0,
    riskScore: 30,
    riskBand: 'LOW',
    exposureSummary: {},
    unvaluedPositionIds: [],
    limitations: [],
    generatedAt: new Date().toISOString(),
    ...patch,
  } as PortfolioOverview;
}

function position(patch: Record<string, unknown> = {}): Position {
  return {
    id: 'pos-1',
    portfolioId: 'p1',
    tokenId: 'tok-1',
    symbol: 'SOL',
    chain: 'SOLANA',
    isNative: false,
    wallets: ['wallet-1'],
    status: 'OPEN',
    quantity: 10,
    costBasis: { averageCostUsd: known(80) },
    valuation: {
      price: { priceUsd: 100 },
      markValue: known(1000),
      estimatedExitValue: known(950),
    },
    pnl: {
      realized: known(0),
      unrealized: known(200),
      total: known(200),
      net: known(190),
      fees: { tradingFeesUsd: 5, networkFeesUsd: 3, dexFeesUsd: 2, totalUsd: 10 },
    },
    allocationPct: 0.42,
    risk: { band: 'LOW' as RiskBand },
    exitability: { score: 88 },
    ...patch,
  } as unknown as Position;
}

describe('portfolio view adapter', () => {
  describe('monetary values', () => {
    it('carries known values straight through', () => {
      const { summary } = adaptPortfolioSummary(overview(), []);
      expect(summary.totalReportedValueUsd).toBe(1000);
      expect(summary.estimatedExecutableValueUsd).toBe(950);
      expect(summary.trueNetPnlUsd).toBe(190);
      expect(summary.knownCostsUsd).toBe(10);
    });

    it('reports an unknown value as unknown rather than as zero', () => {
      // The whole point of MonetaryValue: a price that could not be determined
      // must not render as a confident "$0.00".
      const { summary, unknownFields } = adaptPortfolioSummary(
        overview({ totalValue: known(null) }),
        [],
      );
      expect(unknownFields).toContain('totalReportedValueUsd');
      expect(summary.totalReportedValueUsd).toBe(0); // layout placeholder only
    });

    it('does not flag fields that are genuinely zero', () => {
      const { unknownFields } = adaptPortfolioSummary(overview({ realizedPnl: known(0) }), []);
      expect(unknownFields).not.toContain('realizedPnlUsd');
    });
  });

  describe('percentage conversion', () => {
    it('converts the 0-1 wire fraction to a percentage', () => {
      // sharePct is 0-1 (exposure-engine.ts). Rendering it raw would show
      // "0.6% concentration" for a portfolio that is 60% one token.
      const { summary } = adaptPortfolioSummary(
        overview({ exposureSummary: { largestToken: { symbol: 'SOL', sharePct: 0.6 } } }),
        [],
      );
      expect(summary.concentrationRisk).toBe('HIGH');
    });

    it('converts position allocation to a percentage', () => {
      expect(adaptPosition(position()).portfolioWeightPct).toBeCloseTo(42);
    });

    it('maps concentration bands at their boundaries', () => {
      const at = (fraction: number) =>
        adaptPortfolioSummary(
          overview({ exposureSummary: { largestToken: { symbol: 'X', sharePct: fraction } } }),
          [],
        ).summary.concentrationRisk;
      expect(at(0.5)).toBe('HIGH');
      expect(at(0.49)).toBe('MEDIUM');
      expect(at(0.25)).toBe('MEDIUM');
      expect(at(0.24)).toBe('LOW');
    });
  });

  describe('liquidity health', () => {
    it('calls an empty portfolio good, not poor', () => {
      const { summary } = adaptPortfolioSummary(
        overview({ positionCount: 0, exitabilityIssueCount: 0 }),
        [],
      );
      expect(summary.liquidityHealth).toBe('GOOD');
    });

    it('degrades as flagged positions accumulate', () => {
      const at = (issues: number, count: number) =>
        adaptPortfolioSummary(overview({ exitabilityIssueCount: issues, positionCount: count }), [])
          .summary.liquidityHealth;
      expect(at(0, 4)).toBe('GOOD');
      expect(at(1, 4)).toBe('MODERATE');
      expect(at(2, 4)).toBe('POOR');
    });
  });

  describe('exitability', () => {
    it('weights by position value rather than averaging evenly', () => {
      // A large unexitable position is not offset by a small exitable one.
      const big = position({ valuation: { markValue: known(9000), price: { priceUsd: 1 } }, exitability: { score: 10 } });
      const small = position({ id: 'pos-2', valuation: { markValue: known(1000), price: { priceUsd: 1 } }, exitability: { score: 100 } });
      const { summary } = adaptPortfolioSummary(overview(), [big, small]);
      // Even mean would be 55; value-weighted is 19.
      expect(summary.overallExitability).toBeCloseTo(19);
    });

    it('flags exitability unknown when no position reports a score', () => {
      const p = position({ exitability: undefined });
      const { unknownFields } = adaptPortfolioSummary(overview(), [p]);
      expect(unknownFields).toContain('overallExitability');
    });

    it('leaves exitability unflagged for an empty portfolio', () => {
      const { unknownFields } = adaptPortfolioSummary(overview(), []);
      expect(unknownFields).not.toContain('overallExitability');
    });
  });

  describe('risk exposure', () => {
    it('measures high-risk exposure by value, not by count', () => {
      const risky = position({ valuation: { markValue: known(750), price: { priceUsd: 1 } }, risk: { band: 'SEVERE' } });
      const safe = position({ id: 'pos-2', valuation: { markValue: known(250), price: { priceUsd: 1 } }, risk: { band: 'LOW' } });
      const { summary } = adaptPortfolioSummary(overview(), [risky, safe]);
      expect(summary.insiderExposurePct).toBeCloseTo(75);
    });

    it('ignores unpriced positions when computing exposure share', () => {
      const priced = position({ valuation: { markValue: known(100), price: { priceUsd: 1 } }, risk: { band: 'HIGH' } });
      const unpriced = position({ id: 'pos-2', valuation: { markValue: known(null), price: { priceUsd: null } }, risk: { band: 'LOW' } });
      const { summary } = adaptPortfolioSummary(overview(), [priced, unpriced]);
      expect(summary.insiderExposurePct).toBeCloseTo(100);
    });
  });

  describe('risk band mapping', () => {
    it('maps every engine band to a view level', () => {
      const band = (b: RiskBand) => adaptPosition(position({ risk: { band: b } })).insiderRisk;
      expect(band('SEVERE')).toBe('CRITICAL');
      expect(band('HIGH')).toBe('HIGH');
      expect(band('ELEVATED')).toBe('MEDIUM');
      expect(band('MODERATE')).toBe('MEDIUM');
      expect(band('LOW')).toBe('LOW');
    });

    it('does not understate ELEVATED as LOW', () => {
      expect(adaptPosition(position({ risk: { band: 'ELEVATED' } })).insiderRisk).not.toBe('LOW');
    });
  });

  describe('position mapping', () => {
    it('maps the fields the table renders', () => {
      const row = adaptPosition(position());
      expect(row.symbol).toBe('SOL');
      expect(row.quantity).toBe(10);
      expect(row.currentPriceUsd).toBe(100);
      expect(row.marketValueUsd).toBe(1000);
      expect(row.estimatedExecutableValueUsd).toBe(950);
      expect(row.trueNetPnlUsd).toBe(190);
      expect(row.exitabilityScore).toBe(88);
    });

    it('derives price from mark value when no quote is present', () => {
      const row = adaptPosition(
        position({ quantity: 4, valuation: { markValue: known(200), price: { priceUsd: null } } }),
      );
      expect(row.currentPriceUsd).toBe(50);
    });

    it('does not divide by zero on a closed position', () => {
      const row = adaptPosition(
        position({ quantity: 0, valuation: { markValue: known(0), price: { priceUsd: null } } }),
      );
      expect(Number.isFinite(row.currentPriceUsd)).toBe(true);
      expect(row.currentPriceUsd).toBe(0);
    });

    it('falls back to mark value when exit value is missing', () => {
      const row = adaptPosition(
        position({ valuation: { markValue: known(500), estimatedExitValue: undefined, price: { priceUsd: 1 } } }),
      );
      expect(row.estimatedExecutableValueUsd).toBe(500);
    });
  });

  describe('limitations', () => {
    it('surfaces unvalued positions as a caveat', () => {
      const { limitations } = adaptPortfolioSummary(
        overview({ unvaluedPositionIds: ['a', 'b'] }),
        [],
      );
      expect(limitations.join(' ')).toContain('2 position(s) could not be valued');
    });

    it('passes engine limitations through', () => {
      const { limitations } = adaptPortfolioSummary(overview({ limitations: ['Stale price data'] }), [], [
        'Reconciliation pending',
      ]);
      expect(limitations).toContain('Stale price data');
      expect(limitations).toContain('Reconciliation pending');
    });
  });
});
