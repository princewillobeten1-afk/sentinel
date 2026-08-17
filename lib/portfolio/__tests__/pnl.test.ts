import { describe, it, expect } from 'vitest';
import { processPortfolioPipeline } from '../pipeline';
import { computePositionPnl } from '../pnl-engine';
import { summarizeExecutionCosts } from '../performance-engine';
import { hasValue } from '../utils';
import { getMockPortfolioContext } from '@/lib/mocks/portfolio-mocks';
import type { Position } from '../types';

const result = processPortfolioPipeline({ context: getMockPortfolioContext() });
const positionFor = (symbol: string): Position => {
  const position = result.positions.find((entry) => entry.symbol === symbol);
  if (!position) throw new Error(`Position not found: ${symbol}`);
  return position;
};

describe('Sprint 9 — True Net P&L (spec §4, §5)', () => {
  it('Profit: SENT realized, unrealized, fees and net reconcile exactly', () => {
    const sent = positionFor('SENT');

    // 20,000 sold @ $0.41 against 20,000 of FIFO basis @ $0.25.
    expect(sent.pnl.realized.usd).toBeCloseTo(3_200, 2);

    // 63,000 held, marked at $0.42, against $19,230 of remaining basis.
    expect(sent.quantity).toBe(63_000);
    expect(sent.pnl.unrealized.usd).toBeCloseTo(7_230, 2);

    // Trading + network + DEX fees across all four SENT transactions.
    expect(sent.pnl.fees.totalUsd).toBeCloseTo(113.65, 2);

    // The spec's contract: realized + unrealized − fees = net.
    const expectedNet = 3_200 + 7_230 - 113.65;
    expect(sent.pnl.net.usd).toBeCloseTo(expectedNet, 2);
    expect(sent.pnl.total.usd).toBeCloseTo(10_430, 2);
  });

  it('Loss: QUANT is fully exited and its net loss includes both sides of fees', () => {
    const quant = positionFor('QUANT');

    expect(quant.status).toBe('CLOSED');
    expect(quant.quantity).toBe(0);
    expect(quant.pnl.realized.usd).toBeCloseTo(-5_400, 2);
    expect(quant.pnl.unrealized.usd).toBe(0);
    expect(quant.pnl.fees.totalUsd).toBeCloseTo(86.16, 2);
    expect(quant.pnl.net.usd).toBeCloseTo(-5_486.16, 2);
  });

  it('Per-trade net P&L is fully loaded with acquisition and disposal fees', () => {
    const sent = positionFor('SENT');
    const trade = sent.realizedEntries[0];

    expect(trade.proceeds.usd).toBeCloseTo(8_200, 2);
    expect(trade.costBasis.usd).toBeCloseTo(5_000, 2);
    expect(trade.grossPnl.usd).toBeCloseTo(3_200, 2);
    // $28.73 disposal fees + half of the $35.03 fees on the consumed 40k lot.
    expect(trade.fees.totalUsd).toBeCloseTo(46.245, 2);
    expect(trade.netPnl.usd).toBeCloseTo(3_153.755, 2);
  });

  it('Fees are subtracted exactly once across the whole portfolio', () => {
    const { overview } = result;
    const realized = overview.realizedPnl.usd as number;
    const unrealized = overview.unrealizedPnl.usd as number;
    const net = overview.netPnl.usd as number;

    expect(net).toBeCloseTo(realized + unrealized - overview.fees.totalUsd, 2);
    expect(overview.fees.totalUsd).toBeGreaterThan(0);
  });

  it('Portfolio fee breakdown separates trading, network and DEX fees', () => {
    const { fees } = result.overview;
    expect(fees.tradingFeesUsd).toBeGreaterThan(0);
    expect(fees.networkFeesUsd).toBeGreaterThan(0);
    expect(fees.dexFeesUsd).toBeGreaterThan(0);
    expect(fees.totalUsd).toBeCloseTo(
      fees.tradingFeesUsd + fees.networkFeesUsd + fees.dexFeesUsd,
      6,
    );
  });

  it('Unknown cost basis produces UNKNOWN unrealized P&L, not a fabricated number', () => {
    const drift = positionFor('DRIFT');

    expect(drift.quantity).toBe(5_000);
    expect(drift.costBasis.unknownBasisQuantity).toBe(5_000);
    expect(drift.pnl.hasUnknownBasis).toBe(true);
    expect(hasValue(drift.pnl.unrealized)).toBe(false);
    expect(drift.pnl.unrealized.status).toBe('UNKNOWN');
    // The token still has a mark value — only its P&L is unknown.
    expect(drift.valuation.markValue.usd).toBeCloseTo(4_700, 2);
  });

  it('An internal transfer produces no realized P&L on either leg', () => {
    const bonk = positionFor('BONK');
    expect(bonk.realizedEntries).toHaveLength(0);
    expect(bonk.pnl.realized.usd).toBe(0);
    expect(bonk.quantity).toBe(900_000_000);
  });

  it('Bridged and migrated positions report no realized P&L on the source leg', () => {
    const eth = positionFor('ETH');
    expect(eth.realizedEntries).toHaveLength(0);
    expect(eth.pnl.realized.usd).toBe(0);

    const newx = result.positions.find((position) => position.tokenId === 'dt_newx');
    expect(newx?.realizedEntries).toHaveLength(0);
    expect(newx?.costBasis.remainingCostBasis.usd).toBeCloseTo(2_000, 2);
  });

  it('Partial fills are recorded rather than assumed complete', () => {
    const alpha = positionFor('ALPHA');
    const record = alpha.executionCosts.find((entry) => entry.eventId === 'evt_alpha_buy_1');
    expect(record?.fillRatio).toBeCloseTo(700_000 / 750_000, 6);
  });
});

describe('Sprint 9 — Execution cost analysis (spec §24)', () => {
  it('Captures quoted vs executed price, difference, slippage and fees', () => {
    const sent = positionFor('SENT');
    const buy = sent.executionCosts.find((entry) => entry.eventId === 'evt_sent_buy_1');

    expect(buy?.quotedPriceUsd).toBe(0.248);
    expect(buy?.executedPriceUsd).toBe(0.25);
    expect(buy?.priceDifferenceUsd).toBeCloseTo(0.002, 6);
    // Buying above the quote is negative slippage for the trader.
    expect(buy?.slippagePct).toBeLessThan(0);
    expect(buy?.fees.totalUsd).toBeCloseTo(35.03, 2);
    expect(buy?.status).toBe('KNOWN');
  });

  it('Selling above the quote records positive slippage', () => {
    const quant = positionFor('QUANT');
    const sell = quant.executionCosts.find((entry) => entry.side === 'SELL');
    // Quoted $0.0086, executed $0.008 → filled worse than quoted.
    expect(sell?.slippagePct).toBeLessThan(0);
  });

  it('Execution cost is UNKNOWN when no quote was recorded, never zero', () => {
    const summary = summarizeExecutionCosts([
      {
        eventId: 'e1',
        positionId: 'p1',
        tokenId: 't1',
        transactionHash: 'tx',
        side: 'BUY',
        quantity: 10,
        quotedPriceUsd: null,
        executedPriceUsd: 5,
        priceDifferenceUsd: null,
        slippagePct: null,
        fees: { tradingFeesUsd: 0, networkFeesUsd: 0, dexFeesUsd: 0, totalUsd: 0 },
        executionCostUsd: { status: 'UNKNOWN', usd: null, confidence: 0 },
        fillRatio: null,
        timestamp: new Date().toISOString(),
        status: 'UNKNOWN',
      },
    ]);

    expect(summary.totalExecutionCostUsd.status).toBe('UNKNOWN');
    expect(summary.totalExecutionCostUsd.usd).toBeNull();
    expect(summary.observations.join(' ')).toContain('cannot be assessed');
  });

  it('Portfolio execution summary reports slippage with its sample size', () => {
    const { executionCosts } = result.performance;
    expect(executionCosts.records.length).toBeGreaterThan(0);
    expect(executionCosts.averageSlippagePct.sample.count).toBeGreaterThan(0);
    // Small sample must not present as an adequate one.
    expect(executionCosts.averageSlippagePct.sample.adequacy).not.toBe('ADEQUATE');
  });
});

describe('Sprint 9 — P&L edge cases', () => {
  it('A position with no price returns UNAVAILABLE unrealized P&L', () => {
    const ghost = positionFor('GHOST');
    expect(ghost.valuation.markValue.status).toBe('UNAVAILABLE');
    expect(ghost.pnl.unrealized.status).toBe('UNAVAILABLE');
    expect(ghost.pnl.unrealized.usd).toBeNull();
  });

  it('Zero-quantity positions report zero unrealized, not unknown', () => {
    const pnl = computePositionPnl({
      costBasis: {
        positionId: 'p',
        tokenId: 't',
        chain: 'solana',
        method: 'FIFO',
        acquiredQuantity: 100,
        disposedQuantity: 100,
        remainingQuantity: 0,
        acquisitionCost: { status: 'KNOWN', usd: 100, confidence: 1 },
        averageCostUsd: { status: 'KNOWN', usd: 0, confidence: 1 },
        remainingCostBasis: { status: 'KNOWN', usd: 0, confidence: 1 },
        realizedCostBasis: { status: 'KNOWN', usd: 100, confidence: 1 },
        unknownBasisQuantity: 0,
        lots: [],
      },
      valuation: {
        price: {
          tokenId: 't',
          chain: 'solana',
          priceUsd: 2,
          priceSource: 'test',
          priceTimestamp: new Date().toISOString(),
          confidence: 1,
          status: 'KNOWN',
        },
        markValue: { status: 'KNOWN', usd: 0, confidence: 1 },
        estimatedExitValue: { status: 'KNOWN', usd: 0, confidence: 1 },
        stressExitValue: { status: 'KNOWN', usd: 0, confidence: 1 },
        exitDiscountPct: null,
        isEstimate: true,
      },
      realizedEntries: [],
      fees: { tradingFeesUsd: 1, networkFeesUsd: 0, dexFeesUsd: 0, totalUsd: 1 },
      quantity: 0,
      symbol: 'T',
    });

    expect(pnl.unrealized.usd).toBe(0);
    expect(pnl.net.usd).toBe(-1);
  });
});
