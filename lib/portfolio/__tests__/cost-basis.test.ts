import { describe, it, expect } from 'vitest';
import {
  acquire,
  averageCostPerToken,
  createLotBook,
  dispose,
  remainingCostBasis,
  remainingQuantity,
  summarizeCostBasis,
} from '../cost-basis';
import { classifyEvents } from '../classification';
import { buildPositions, draftCostBasis } from '../position-engine';
import { hasValue } from '../utils';
import type { AccountingMethod, RawLedgerEvent } from '../types';
import {
  MOCK_LEDGER_EVENTS,
  MOCK_MAIN_WALLET,
  MOCK_PORTFOLIO_TOKENS,
  MOCK_TRADING_WALLET,
  MOCK_WALLETS,
} from '@/lib/mocks/portfolio-mocks';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-05T00:00:00.000Z';
const T2 = '2026-01-10T00:00:00.000Z';
const T3 = '2026-01-20T00:00:00.000Z';

function book(method: AccountingMethod = 'FIFO') {
  return createLotBook('pos_test', 'tok_test', 'solana', method);
}

function buy(b: ReturnType<typeof book>, quantity: number, price: number | null, at: string, fees = 0) {
  return acquire(b, {
    wallet: 'w1',
    quantity,
    pricePerTokenUsd: price,
    feesUsd: fees,
    timestamp: at,
    transactionHash: `tx_${at}_${quantity}`,
    eventId: `evt_${at}_${quantity}`,
    source: price === null ? 'AIRDROP' : 'BUY',
    certainty: price === null ? 'UNKNOWN' : 'KNOWN',
  });
}

function classify(events: RawLedgerEvent[], wallets = MOCK_WALLETS.map((w) => w.address)) {
  return classifyEvents(events, { ownedWallets: wallets });
}

describe('Sprint 9 — Cost basis & lot tracking (spec §6, §7, §56)', () => {
  it('Single buy: acquisition cost, average cost and remaining basis all agree', () => {
    const b = book();
    buy(b, 1_000, 2, T0, 5);

    const state = summarizeCostBasis(b);
    expect(state.acquiredQuantity).toBe(1_000);
    expect(state.remainingQuantity).toBe(1_000);
    expect(state.acquisitionCost.usd).toBe(2_000);
    expect(state.averageCostUsd.usd).toBe(2);
    expect(state.remainingCostBasis.usd).toBe(2_000);
    expect(state.lots).toHaveLength(1);
    // Fees are held on the lot, not folded into basis.
    expect(state.lots[0].feesUsd).toBe(5);
  });

  it('Multiple buys: average cost is quantity-weighted across lots', () => {
    const b = book();
    buy(b, 1_000, 2, T0);
    buy(b, 1_000, 4, T1);

    expect(remainingQuantity(b)).toBe(2_000);
    expect(averageCostPerToken(b).usd).toBe(3);
    expect(remainingCostBasis(b).usd).toBe(6_000);
  });

  it('Partial sell under FIFO consumes the oldest lot first', () => {
    const b = book('FIFO');
    buy(b, 1_000, 2, T0);
    buy(b, 1_000, 5, T1);

    const result = dispose(b, 1_200, T2);
    expect(result.consumedQuantity).toBe(1_200);
    expect(result.unmatchedQuantity).toBe(0);
    // 1000 @ $2 + 200 @ $5 = 3000
    expect(result.costBasis.usd).toBe(3_000);
    expect(remainingQuantity(b)).toBe(800);
    expect(remainingCostBasis(b).usd).toBe(4_000);
  });

  it('Partial sell under LIFO consumes the newest lot first', () => {
    const b = book('LIFO');
    buy(b, 1_000, 2, T0);
    buy(b, 1_000, 5, T1);

    const result = dispose(b, 1_200, T2);
    // 1000 @ $5 + 200 @ $2 = 5400
    expect(result.costBasis.usd).toBe(5_400);
  });

  it('HIFO consumes the highest-cost lot first', () => {
    const b = book('HIFO');
    buy(b, 500, 2, T0);
    buy(b, 500, 9, T1);
    buy(b, 500, 5, T2);

    const result = dispose(b, 600, T3);
    // 500 @ $9 + 100 @ $5 = 5000
    expect(result.costBasis.usd).toBe(5_000);
  });

  it('AVERAGE consumes pro-rata and leaves the average cost unchanged', () => {
    const b = book('AVERAGE');
    buy(b, 1_000, 2, T0);
    buy(b, 1_000, 6, T1);

    const before = averageCostPerToken(b).usd;
    const result = dispose(b, 1_000, T2);

    expect(result.costBasis.usd).toBe(4_000);
    expect(averageCostPerToken(b).usd).toBeCloseTo(before as number, 6);
  });

  it('Full sell empties the book and moves all basis to realized', () => {
    const b = book();
    buy(b, 1_000, 3, T0);
    const result = dispose(b, 1_000, T1);

    const state = summarizeCostBasis(b);
    expect(result.consumedQuantity).toBe(1_000);
    expect(state.remainingQuantity).toBe(0);
    expect(state.remainingCostBasis.usd).toBe(0);
    expect(state.realizedCostBasis.usd).toBe(3_000);
  });

  it('Selling more than the recorded holding surfaces unmatched quantity instead of inventing basis', () => {
    const b = book();
    buy(b, 500, 2, T0);
    const result = dispose(b, 900, T1);

    expect(result.consumedQuantity).toBe(500);
    expect(result.unmatchedQuantity).toBe(400);
    expect(result.costBasis.usd).toBe(1_000);
  });

  it('Airdropped lots carry UNKNOWN basis and never contribute a silent $0 cost', () => {
    const b = book();
    buy(b, 1_000, 2, T0);
    buy(b, 500, null, T1); // airdrop

    const state = summarizeCostBasis(b);
    expect(state.unknownBasisQuantity).toBe(500);
    // Remaining basis is degraded, not inflated with a fabricated zero-cost lot.
    expect(state.remainingCostBasis.status).toBe('ESTIMATED');
    expect(state.remainingCostBasis.usd).toBe(2_000);
    expect(state.averageCostUsd.status).toBe('ESTIMATED');
  });

  it('Disposing an unknown-basis lot reports the unknown quantity on the disposal', () => {
    const b = book();
    buy(b, 500, null, T0); // airdrop first
    buy(b, 500, 4, T1);

    const result = dispose(b, 600, T2);
    expect(result.unknownBasisQuantity).toBe(500);
    expect(hasValue(result.costBasis)).toBe(true);
    expect(result.costBasis.usd).toBe(400); // only the 100 known units @ $4
  });

  it('Holding period is tracked per consumed slice', () => {
    const b = book();
    buy(b, 1_000, 2, T0);
    const result = dispose(b, 1_000, T1);
    // T0 → T1 is 4 days.
    expect(result.weightedHoldingHours).toBeCloseTo(96, 1);
  });
});

describe('Sprint 9 — Cost basis through classified events (spec §56)', () => {
  const classified = classify(MOCK_LEDGER_EVENTS);
  const { drafts } = buildPositions({
    portfolioId: 'pf_test',
    classified,
    tokens: MOCK_PORTFOLIO_TOKENS,
    observedAt: new Date().toISOString(),
  });

  const byToken = (tokenId: string) => drafts.find((draft) => draft.tokenId === tokenId);

  it('Transfers between grouped wallets leave quantity and basis untouched', () => {
    const bonk = byToken('dt_bonk');
    expect(bonk).toBeDefined();
    const state = draftCostBasis(bonk!);
    // 900M bought; 400M moved internally between two owned wallets.
    expect(state.remainingQuantity).toBe(900_000_000);
    expect(bonk!.realizedEntries).toHaveLength(0);
    expect(bonk!.wallets).toContain(MOCK_MAIN_WALLET);
    expect(bonk!.wallets).toContain(MOCK_TRADING_WALLET);
  });

  it('Airdrops produce a lot with unknown basis', () => {
    const drift = byToken('dt_drift');
    const state = draftCostBasis(drift!);
    expect(state.remainingQuantity).toBe(5_000);
    expect(state.unknownBasisQuantity).toBe(5_000);
    expect(state.remainingCostBasis.status).toBe('UNKNOWN');
  });

  it('Bridges carry basis to the destination chain rather than realizing a sale', () => {
    const ethereum = byToken('dt_eth');
    const base = byToken('dt_eth_base');

    // The outbound leg must not create a realized entry.
    expect(ethereum!.realizedEntries).toHaveLength(0);
    expect(draftCostBasis(ethereum!).remainingQuantity).toBe(4);

    const baseState = draftCostBasis(base!);
    expect(baseState.remainingQuantity).toBe(2);
    // 2 ETH out of 6 bought at $2450 → $4900 of basis carried across.
    expect(baseState.remainingCostBasis.usd).toBeCloseTo(4_900, 2);
    expect(baseState.lots[0].certainty).toBe('CARRIED_OVER');
    expect(baseState.lots[0].carriedFrom?.chain).toBe('ethereum');
  });

  it('Token migrations preserve economic history across the token change', () => {
    const oldx = byToken('dt_oldx');
    const newx = byToken('dt_newx');

    expect(oldx!.realizedEntries).toHaveLength(0);
    expect(draftCostBasis(oldx!).remainingQuantity).toBe(0);

    const newState = draftCostBasis(newx!);
    expect(newState.remainingQuantity).toBe(50_000);
    // $2,000 of basis migrated into half the token count → $0.04/token.
    expect(newState.remainingCostBasis.usd).toBeCloseTo(2_000, 2);
    expect(newState.averageCostUsd.usd).toBeCloseTo(0.04, 6);
  });

  it('Duplicate ingestion of the same chain event does not duplicate lots', () => {
    const sent = byToken('dt_sentinel');
    const state = draftCostBasis(sent!);
    // 40k + 25k + 18k bought, 20k sold. The duplicated 25k buy is suppressed.
    expect(state.acquiredQuantity).toBe(83_000);
    expect(state.remainingQuantity).toBe(63_000);
  });
});
