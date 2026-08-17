import { describe, it, expect } from 'vitest';
import {
  createQuote,
  simulateExecution,
  isQuoteFresh,
  TransactionStateMachine,
} from '../execution-simulator';
import { getSentExitabilityContext, getQuantExitabilityContext } from '@/lib/mocks/exitability-mocks';
import { isoAfter } from '../utils';

function sentQuoteInput(inputUsd: number) {
  const context = getSentExitabilityContext();
  return {
    chain: 'solana',
    tokenId: context.tokenId,
    side: 'SELL' as const,
    inputUsd,
    pools: context.pools,
    recentPriceVolatility: context.recentPriceVolatility,
    observedAt: context.observedAt,
  };
}

describe('Sprint 8 — Execution simulation', () => {
  it('creates a quote separated from execution, with freshness metadata', () => {
    const quote = createQuote(sentQuoteInput(5_000));
    expect(quote.isSimulation).toBe(true);
    expect(quote.quotedAt).toBeDefined();
    expect(quote.expiresAt).toBeDefined();
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(new Date(quote.quotedAt).getTime());
    expect(quote.minimumReceivedUsd).toBeLessThanOrEqual(quote.expectedOutputUsd);
  });

  it('detects an expired quote', () => {
    const quote = createQuote(sentQuoteInput(5_000));
    const laterIso = isoAfter(quote.quotedAt, 999);
    expect(isQuoteFresh(quote, quote.quotedAt)).toBe(true);
    expect(isQuoteFresh(quote, laterIso)).toBe(false);
  });

  it('simulation passes validation for a well-funded sell', () => {
    const context = getSentExitabilityContext();
    const sim = simulateExecution({
      ...sentQuoteInput(5_000),
      walletTokenBalanceUsd: 10_000,
      slippageTolerancePct: 20,
      nowIso: context.observedAt,
    });
    expect(sim.status).toBe('SIMULATED');
    expect(sim.validations.every((v) => v.passed)).toBe(true);
  });

  it('fails validation when token balance is insufficient', () => {
    const sim = simulateExecution({
      ...sentQuoteInput(5_000),
      walletTokenBalanceUsd: 100,
      slippageTolerancePct: 50,
    });
    expect(sim.status).toBe('VALIDATION_FAILED');
    expect(sim.validations.find((v) => v.check === 'token_balance')?.passed).toBe(false);
  });

  it('flags slippage exceeded when tolerance is tighter than estimate', () => {
    const sim = simulateExecution({
      ...sentQuoteInput(50_000),
      walletTokenBalanceUsd: 1_000_000,
      slippageTolerancePct: 0.1,
    });
    expect(sim.status).toBe('SLIPPAGE_EXCEEDED');
  });

  it('detects pool change after quote (quote race)', () => {
    const sim = simulateExecution({
      ...sentQuoteInput(5_000),
      walletTokenBalanceUsd: 1_000_000,
      slippageTolerancePct: 50,
      quotedPoolHash: 'hash_A',
      currentPoolHash: 'hash_B',
    });
    expect(sim.status).toBe('POOL_CHANGED');
  });

  it('reports insufficient liquidity for an order that dwarfs the pool', () => {
    const quant = getQuantExitabilityContext();
    const sim = simulateExecution({
      chain: 'solana',
      tokenId: quant.tokenId,
      side: 'SELL',
      inputUsd: 5_000_000,
      pools: quant.pools,
      observedAt: quant.observedAt,
      walletTokenBalanceUsd: 10_000_000,
      slippageTolerancePct: 90,
    });
    expect(sim.status).toBe('INSUFFICIENT_LIQUIDITY');
  });

  it('transaction state machine enforces legal transitions', () => {
    const sm = new TransactionStateMachine();
    const now = new Date().toISOString();
    expect(sm.state).toBe('CREATED');
    expect(sm.transition('SUBMITTING', now)).toBe(false); // illegal skip
    expect(sm.transition('SIMULATING', now)).toBe(true);
    expect(sm.transition('SIMULATED', now)).toBe(true);
    expect(sm.transition('SUBMITTING', now)).toBe(true);
    expect(sm.transition('SUBMITTED', now)).toBe(true);
    expect(sm.transition('CONFIRMING', now)).toBe(true);
    expect(sm.transition('CONFIRMED', now)).toBe(true);
    expect(sm.isTerminal()).toBe(true);
    expect(sm.transition('SUBMITTING', now)).toBe(false);
  });
});
