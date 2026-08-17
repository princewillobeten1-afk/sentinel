/**
 * Sprint 9 — Adversarial suite (spec §57)
 *
 * Each numbered test maps directly to a scenario in the spec. These are the
 * cases where a portfolio tracker most easily produces a confident, wrong
 * number, so the assertions are about what the system must NOT do as much as
 * what it must.
 */

import { describe, it, expect } from 'vitest';
import { processPortfolioPipeline } from '../pipeline';
import { classifyEvents } from '../classification';
import { buildPositions } from '../position-engine';
import { valuePosition } from '../valuation';
import { hasValue } from '../utils';
import { planRecompute, invalidate, readCache, resetCache, writeCache } from '../cache';
import type { PortfolioContext, RawLedgerEvent } from '../types';
import {
  MOCK_EXTERNAL_WALLET,
  MOCK_LEDGER_EVENTS,
  MOCK_MAIN_WALLET,
  MOCK_PORTFOLIO_TOKENS,
  MOCK_PRICES,
  MOCK_TRADING_WALLET,
  MOCK_WALLETS,
  getIlliquidPortfolioContext,
  getMockPortfolioContext,
  getUnpricedPortfolioContext,
} from '@/lib/mocks/portfolio-mocks';

const NOW = new Date().toISOString();
const OWNED = MOCK_WALLETS.map((wallet) => wallet.address);

function run(context: PortfolioContext) {
  return processPortfolioPipeline({ context });
}

function positionsFrom(events: RawLedgerEvent[], ownedWallets = OWNED) {
  const classified = classifyEvents(events, { ownedWallets });
  return buildPositions({
    portfolioId: 'pf_adv',
    classified,
    tokens: MOCK_PORTFOLIO_TOKENS,
    observedAt: NOW,
  });
}

// ────────────────────────────────────────────────────────────────────────────

describe('Test 1 — Internal transfer produces no false realized P&L', () => {
  const events: RawLedgerEvent[] = [
    {
      id: 'a1',
      txHash: 'tx_buy',
      chain: 'solana',
      wallet: MOCK_MAIN_WALLET,
      tokenId: 'dt_sentinel',
      symbol: 'SENT',
      direction: 'IN',
      quantity: 10_000,
      pricePerTokenUsd: 0.2,
      source: 'DEX_SWAP',
      status: 'CONFIRMED',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'a2',
      txHash: 'tx_move',
      chain: 'solana',
      wallet: MOCK_MAIN_WALLET,
      tokenId: 'dt_sentinel',
      symbol: 'SENT',
      direction: 'OUT',
      quantity: 6_000,
      counterpartyWallet: MOCK_TRADING_WALLET,
      source: 'TRANSFER',
      status: 'CONFIRMED',
      timestamp: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'a3',
      txHash: 'tx_move',
      chain: 'solana',
      wallet: MOCK_TRADING_WALLET,
      tokenId: 'dt_sentinel',
      symbol: 'SENT',
      direction: 'IN',
      quantity: 6_000,
      counterpartyWallet: MOCK_MAIN_WALLET,
      source: 'TRANSFER',
      status: 'CONFIRMED',
      timestamp: '2026-02-01T00:00:00.000Z',
    },
  ];

  it('classifies both legs as internal and marks them P&L-neutral', () => {
    const classified = classifyEvents(events, { ownedWallets: OWNED });
    const legs = classified.filter((item) => item.classification.startsWith('INTERNAL_TRANSFER'));
    expect(legs).toHaveLength(2);
    expect(legs.every((leg) => leg.pnlNeutral)).toBe(true);
    expect(legs.every((leg) => leg.evidence.length > 0)).toBe(true);
  });

  it('leaves quantity and cost basis unchanged, with zero realized P&L', () => {
    const { drafts } = positionsFrom(events);
    const sent = drafts.find((draft) => draft.tokenId === 'dt_sentinel');

    expect(sent?.realizedEntries).toHaveLength(0);
    expect(sent?.book.disposedQuantity).toBe(0);
    expect(sent?.book.acquiredQuantity).toBe(10_000);
  });

  it('still records the movement on the timeline for auditability', () => {
    const { drafts } = positionsFrom(events);
    const sent = drafts.find((draft) => draft.tokenId === 'dt_sentinel');
    const transfers = sent?.timeline.filter((event) =>
      ['TRANSFER_IN', 'TRANSFER_OUT'].includes(event.type),
    );
    expect(transfers?.length).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 2 — Duplicate blockchain event creates no duplicate position', () => {
  const base: RawLedgerEvent = {
    id: 'b1',
    txHash: 'tx_dup',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 5_000,
    pricePerTokenUsd: 0.3,
    tradingFeeUsd: 5,
    source: 'DEX_SWAP',
    status: 'CONFIRMED',
    timestamp: '2026-03-01T00:00:00.000Z',
  };

  it('suppresses a re-ingested identical event and records the correction', () => {
    const { drafts, reconciliation } = positionsFrom([base, { ...base, id: 'b1_again' }]);
    const sent = drafts.find((draft) => draft.tokenId === 'dt_sentinel');

    expect(drafts).toHaveLength(1);
    expect(sent?.book.lots).toHaveLength(1);
    expect(sent?.book.acquiredQuantity).toBe(5_000);
    expect(reconciliation.duplicateEvents).toBe(1);
    expect(reconciliation.corrections[0].reason).toBe('DUPLICATE');
  });

  it('does not double-count fees from a duplicated event', () => {
    const { drafts } = positionsFrom([base, { ...base, id: 'b1_again' }]);
    expect(drafts[0].fees.totalUsd).toBe(5);
  });

  it('the full mock portfolio suppresses its planted duplicate', () => {
    const result = run(getMockPortfolioContext());
    expect(result.reconciliation.duplicateEvents).toBe(1);
    const sent = result.positions.find((position) => position.symbol === 'SENT');
    expect(sent?.costBasis.acquiredQuantity).toBe(83_000);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 3 — Reorg reconciles without corrupting history', () => {
  const confirmed: RawLedgerEvent = {
    id: 'c1',
    txHash: 'tx_good',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 4_000,
    pricePerTokenUsd: 0.25,
    source: 'DEX_SWAP',
    status: 'CONFIRMED',
    timestamp: '2026-03-01T00:00:00.000Z',
  };

  const reorged: RawLedgerEvent = {
    ...confirmed,
    id: 'c2',
    txHash: 'tx_reorged',
    quantity: 9_000,
    status: 'REORGED',
    timestamp: '2026-03-02T00:00:00.000Z',
  };

  it('excludes reorged events from derived position state', () => {
    const { drafts, reconciliation } = positionsFrom([confirmed, reorged]);
    const sent = drafts.find((draft) => draft.tokenId === 'dt_sentinel');

    expect(sent?.book.acquiredQuantity).toBe(4_000);
    expect(reconciliation.rejectedEvents).toBe(1);
    expect(reconciliation.corrections.some((entry) => entry.reason === 'REORGED')).toBe(true);
    expect(reconciliation.rebuilt).toBe(true);
  });

  it('records a correction event on the timeline instead of deleting history', () => {
    const { drafts } = positionsFrom([confirmed, reorged]);
    const correction = drafts[0].timeline.find((event) => event.type === 'CORRECTION');
    expect(correction).toBeDefined();
    expect(correction?.detail).toContain('rolled back');
  });

  it('drops a superseded event when a replacement arrives', () => {
    const replacement: RawLedgerEvent = {
      ...confirmed,
      id: 'c3',
      txHash: 'tx_replacement',
      quantity: 4_000,
      timestamp: '2026-03-03T00:00:00.000Z',
      hints: { replacesEventId: 'c1' },
    };
    const { drafts, reconciliation } = positionsFrom([confirmed, replacement]);

    expect(drafts[0].book.acquiredQuantity).toBe(4_000);
    expect(reconciliation.corrections.some((entry) => entry.reason === 'SUPERSEDED')).toBe(true);
  });

  it('failed and dropped transactions are treated the same way', () => {
    const failed: RawLedgerEvent = { ...confirmed, id: 'c4', txHash: 'tx_failed', status: 'FAILED' };
    const dropped: RawLedgerEvent = { ...confirmed, id: 'c5', txHash: 'tx_dropped', status: 'DROPPED' };
    const { drafts, reconciliation } = positionsFrom([confirmed, failed, dropped]);

    expect(drafts[0].book.acquiredQuantity).toBe(4_000);
    expect(reconciliation.rejectedEvents).toBe(2);
  });

  it('a reorg plan triggers a full rebuild rather than an incremental patch', () => {
    const plan = planRecompute('REORG');
    expect(plan.fullRebuild).toBe(true);
    expect(plan.synchronous).toContain('PORTFOLIO_OVERVIEW');
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 4 — Missing historical price marks the value uncertain', () => {
  it('a missing price yields UNAVAILABLE, never 0', () => {
    const result = run(getUnpricedPortfolioContext());
    const ghost = result.positions.find((position) => position.symbol === 'GHOST');

    expect(ghost?.quantity).toBe(250_000);
    expect(ghost?.valuation.markValue.status).toBe('UNAVAILABLE');
    expect(ghost?.valuation.markValue.usd).toBeNull();
    expect(ghost?.limitations.join(' ')).toContain('VALUE_UNAVAILABLE');
  });

  it('a stale price is flagged rather than used silently', () => {
    const result = run(getMockPortfolioContext());
    const newx = result.positions.find((position) => position.symbol === 'NEWX');

    expect(newx?.valuation.markValue.status).toBe('STALE');
    expect(newx?.valuation.price.ageSeconds).toBeGreaterThan(120);
    expect(newx?.limitations.join(' ')).toContain('marked stale');
  });

  it('an unknown acquisition cost is not replaced with zero', () => {
    const result = run(getMockPortfolioContext());
    const drift = result.positions.find((position) => position.symbol === 'DRIFT');

    expect(drift?.costBasis.remainingCostBasis.status).toBe('UNKNOWN');
    expect(drift?.costBasis.remainingCostBasis.usd).toBeNull();
    expect(drift?.pnl.unrealized.usd).toBeNull();
  });

  it('a partially valued portfolio total reports how much is missing', () => {
    const result = run(getMockPortfolioContext());
    expect(result.overview.totalValue.status).toBe('ESTIMATED');
    expect(result.overview.totalValue.note).toContain('had no value and are excluded');
    expect(result.overview.unvaluedPositionIds).toHaveLength(1);
  });

  it('0, Unknown and Unavailable are three distinguishable states', () => {
    const result = run(getMockPortfolioContext());
    const closed = result.positions.find((position) => position.symbol === 'QUANT');
    const unknown = result.positions.find((position) => position.symbol === 'DRIFT');
    const unavailable = result.positions.find((position) => position.symbol === 'GHOST');

    expect(closed?.valuation.markValue.usd).toBe(0);
    expect(closed?.valuation.markValue.status).toBe('KNOWN');
    expect(unknown?.pnl.unrealized.status).toBe('UNKNOWN');
    expect(unavailable?.valuation.markValue.status).toBe('UNAVAILABLE');
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 5 — Illiquid token separates marked value from executable value', () => {
  it('the position surfaces the gap between mark and estimated exit', () => {
    const result = run(getIlliquidPortfolioContext());
    const alpha = result.positions.find((position) => position.symbol === 'ALPHA');

    expect(alpha?.valuation.markValue.usd).toBe(35_000);
    expect(alpha?.valuation.estimatedExitValue.usd as number).toBeLessThan(35_000);
    expect(alpha?.valuation.stressExitValue.usd as number).toBeLessThan(
      alpha?.valuation.estimatedExitValue.usd as number,
    );
    expect(alpha?.valuation.exitDiscountPct as number).toBeGreaterThan(0);
  });

  it('a position that dwarfs usable liquidity is qualified, never shown bare', () => {
    const result = run(getIlliquidPortfolioContext());
    const alpha = result.positions.find((position) => position.symbol === 'ALPHA');

    expect(alpha?.liquidityAdjusted?.liquidityRatio as number).toBeGreaterThan(0.25);
    expect(alpha?.limitations.join(' ')).toContain('materially higher than what could realistically be executed');
  });

  it('exit value is never fabricated when no exitability analysis exists', () => {
    const valuation = valuePosition({
      tokenId: 'dt_ghost',
      chain: 'solana',
      quantity: 1_000,
      price: MOCK_PRICES.dt_sentinel,
      exitability: undefined,
      observedAt: NOW,
    });

    expect(hasValue(valuation.markValue)).toBe(true);
    expect(valuation.estimatedExitValue.status).toBe('UNAVAILABLE');
    expect(valuation.estimatedExitValue.usd).toBeNull();
  });

  it('exit value scales down with position size on the same token', () => {
    const context = getMockPortfolioContext();
    const report = context.exitability?.dt_quant;
    const small = valuePosition({
      tokenId: 'dt_quant',
      chain: 'solana',
      quantity: 125_000, // ~$1K
      price: MOCK_PRICES.dt_quant,
      exitability: report,
      observedAt: NOW,
    });
    const large = valuePosition({
      tokenId: 'dt_quant',
      chain: 'solana',
      quantity: 6_250_000, // ~$50K
      price: MOCK_PRICES.dt_quant,
      exitability: report,
      observedAt: NOW,
    });

    expect(small.exitDiscountPct as number).toBeLessThan(large.exitDiscountPct as number);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 6 — A huge whale position raises portfolio risk appropriately', () => {
  it('concentrating the portfolio into one thin token raises the score and names why', () => {
    const balanced = run(getMockPortfolioContext());

    const whaleEvents = MOCK_LEDGER_EVENTS.filter(
      (event) => event.tokenId === 'dt_alpha' && event.status === 'CONFIRMED',
    ).map((event) => ({ ...event, quantity: event.quantity * 12 }));

    const whale = run(
      getMockPortfolioContext({
        portfolioId: 'pf_whale',
        events: whaleEvents,
        previousPositions: undefined,
      }),
    );

    expect(whale.risk.score).toBeGreaterThan(balanced.risk.score);
    expect(whale.exposure.concentration.largestPositionPct as number).toBeGreaterThan(0.95);
    expect(whale.risk.drivers.some((driver) => driver.key === 'CONCENTRATION')).toBe(true);
    expect(whale.risk.drivers.some((driver) => driver.key === 'LIQUIDITY')).toBe(true);
  });

  it('the whale position’s executable value collapses relative to its mark', () => {
    const whaleEvents = MOCK_LEDGER_EVENTS.filter(
      (event) => event.tokenId === 'dt_alpha' && event.status === 'CONFIRMED',
    ).map((event) => ({ ...event, quantity: event.quantity * 12 }));

    const whale = run(
      getMockPortfolioContext({ portfolioId: 'pf_whale', events: whaleEvents, previousPositions: undefined }),
    );
    const alpha = whale.positions.find((position) => position.symbol === 'ALPHA');

    expect(alpha?.valuation.exitDiscountPct as number).toBeGreaterThan(0.2);
    expect(alpha?.risk.band === 'HIGH' || alpha?.risk.band === 'SEVERE').toBe(true);
  });

  it('raises a concentration warning alert', () => {
    const whaleEvents = MOCK_LEDGER_EVENTS.filter(
      (event) => event.tokenId === 'dt_alpha' && event.status === 'CONFIRMED',
    ).map((event) => ({ ...event, quantity: event.quantity * 12 }));

    const whale = run(
      getMockPortfolioContext({ portfolioId: 'pf_whale', events: whaleEvents, previousPositions: undefined }),
    );
    expect(whale.alertEvents.some((event) => event.type === 'CONCENTRATION_WARNING')).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Test 7 — High P&L on a tiny sample keeps confidence low', () => {
  it('a 100% win rate over 2 trades is reported as insufficient', () => {
    const result = run(getMockPortfolioContext());
    const all = result.performance.windows.find((window) => window.window === 'ALL');

    expect(all?.trading.totalTrades).toBeLessThan(5);
    expect(all?.trading.winRate.sample.adequacy).toBe('INSUFFICIENT');
    expect(all?.trading.winRate.status).toBe('ESTIMATED');
  });

  it('risk-adjusted ratios are suppressed entirely at tiny samples', () => {
    const result = run(getMockPortfolioContext());
    const all = result.performance.windows.find((window) => window.window === 'ALL');

    expect(all?.trading.sharpeLike.value).toBeNull();
    expect(all?.trading.sortinoLike.value).toBeNull();
    expect(all?.trading.profitFactor.value).toBeNull();
    expect(all?.trading.expectancyUsd.value).toBeNull();
  });

  it('the performance report says why confidence is low', () => {
    const result = run(getMockPortfolioContext());
    expect(result.performance.limitations.join(' ')).toContain('closed trade');
  });

  it('a portfolio with no closed trades reports UNKNOWN rather than 0% win rate', () => {
    const noTrades = run(
      getMockPortfolioContext({
        portfolioId: 'pf_no_trades',
        events: MOCK_LEDGER_EVENTS.filter((event) => event.direction === 'IN' && event.status === 'CONFIRMED'),
        previousPositions: undefined,
      }),
    );
    const all = noTrades.performance.windows.find((window) => window.window === 'ALL');

    expect(all?.trading.totalTrades).toBe(0);
    expect(all?.trading.winRate.value).toBeNull();
    expect(all?.trading.winRate.status).toBe('UNKNOWN');
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe('Additional adversarial cases', () => {
  it('an inbound transfer from an unrelated wallet is not treated as a purchase', () => {
    const events: RawLedgerEvent[] = [
      {
        id: 'x1',
        txHash: 'tx_ext',
        chain: 'solana',
        wallet: MOCK_MAIN_WALLET,
        tokenId: 'dt_sentinel',
        symbol: 'SENT',
        direction: 'IN',
        quantity: 1_000,
        counterpartyWallet: MOCK_EXTERNAL_WALLET,
        source: 'TRANSFER',
        status: 'CONFIRMED',
        timestamp: NOW,
      },
    ];
    const classified = classifyEvents(events, { ownedWallets: OWNED });
    expect(classified[0].classification).toBe('EXTERNAL_TRANSFER_IN');
    expect(classified[0].costBasisCertainty).toBe('UNKNOWN');
    expect(classified[0].pnlNeutral).toBe(true);
  });

  it('a bridge is never read as a sell on one chain and a buy on the other', () => {
    const bridgeEvents = MOCK_LEDGER_EVENTS.filter((event) => event.source === 'BRIDGE');
    const classified = classifyEvents(bridgeEvents, { ownedWallets: OWNED });

    expect(classified.map((item) => item.classification).sort()).toEqual(['BRIDGE_IN', 'BRIDGE_OUT']);
    expect(classified.every((item) => item.pnlNeutral)).toBe(true);
    expect(classified.every((item) => item.confidence >= 0.8)).toBe(true);
  });

  it('a pending transaction is shown but never counted as final', () => {
    const result = run(getMockPortfolioContext());
    const alpha = result.positions.find((position) => position.symbol === 'ALPHA');

    expect(alpha?.pending).toHaveLength(1);
    expect(alpha?.pending[0].isFinal).toBe(false);
    expect(alpha?.pending[0].kind).toBe('PENDING_SELL');
    // Quantity still reflects only confirmed state.
    expect(alpha?.quantity).toBe(700_000);
    expect(alpha?.limitations.join(' ')).toContain('not reflected as final');
  });

  it('a pending transaction with no price has an UNKNOWN estimated result, not zero', () => {
    const events: RawLedgerEvent[] = [
      {
        id: 'p1',
        txHash: 'tx_pending',
        chain: 'solana',
        wallet: MOCK_MAIN_WALLET,
        tokenId: 'dt_sentinel',
        symbol: 'SENT',
        direction: 'IN',
        quantity: 100,
        source: 'DEX_SWAP',
        status: 'PENDING',
        timestamp: NOW,
      },
    ];
    const { drafts } = positionsFrom(events);
    expect(drafts[0].pending[0].estimatedValue.status).toBe('UNKNOWN');
    expect(drafts[0].pending[0].estimatedValue.usd).toBeNull();
  });

  it('a sale with no observable execution price yields UNKNOWN P&L, not a loss', () => {
    const events: RawLedgerEvent[] = [
      {
        id: 'n1',
        txHash: 'tx_b',
        chain: 'solana',
        wallet: MOCK_MAIN_WALLET,
        tokenId: 'dt_sentinel',
        symbol: 'SENT',
        direction: 'IN',
        quantity: 1_000,
        pricePerTokenUsd: 0.3,
        source: 'DEX_SWAP',
        status: 'CONFIRMED',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'n2',
        txHash: 'tx_s',
        chain: 'solana',
        wallet: MOCK_MAIN_WALLET,
        tokenId: 'dt_sentinel',
        symbol: 'SENT',
        direction: 'OUT',
        quantity: 500,
        pricePerTokenUsd: null,
        source: 'DEX_SWAP',
        status: 'CONFIRMED',
        timestamp: '2026-02-01T00:00:00.000Z',
      },
    ];
    const { drafts } = positionsFrom(events);
    const entry = drafts[0].realizedEntries[0];

    expect(entry.proceeds.status).toBe('UNKNOWN');
    expect(entry.netPnl.status).toBe('UNKNOWN');
    expect(entry.netPnl.usd).toBeNull();
  });

  it('cache invalidation cascades to derived scopes instead of flushing everything', () => {
    resetCache();
    writeCache('PRICE', 'pf_x', { a: 1 });
    writeCache('POSITION', 'pf_x', { b: 2 });
    writeCache('PERFORMANCE', 'pf_x', { c: 3 });
    writeCache('POSITION', 'pf_other', { d: 4 });

    const affected = invalidate('PRICE', 'pf_x');

    expect(affected).toContain('POSITION');
    expect(readCache('PRICE', 'pf_x')).toBeNull();
    expect(readCache('POSITION', 'pf_x')).toBeNull();
    // A price tick does not invalidate historical performance…
    expect(readCache('PERFORMANCE', 'pf_x')).not.toBeNull();
    // …and never touches another portfolio.
    expect(readCache('POSITION', 'pf_other')).not.toBeNull();
    resetCache();
  });

  it('a price tick is an incremental recompute, not a full rebuild', () => {
    const plan = planRecompute('PRICE_TICK');
    expect(plan.fullRebuild).toBe(false);
    expect(plan.asynchronous).toContain('RISK');
  });

  it('adding a wallet forces reclassification because transfers may become internal', () => {
    const plan = planRecompute('WALLET_ADDED');
    expect(plan.fullRebuild).toBe(true);
    expect(plan.rationale).toContain('internal');
  });
});
