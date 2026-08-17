/**
 * Execution Simulation Engine (spec §5, §13, §14, §39–42, §44, §58)
 *
 * Produces quotes (estimates) and simulations (validated pre-execution checks),
 * strictly separated from execution itself. Includes the transaction state
 * machine and failed-transaction prevention.
 *
 * SECURITY (spec §57): this module performs deterministic validation only. It
 * never broadcasts. An AI model must never reach a broadcast path — execution
 * requires explicit user authorization outside this engine.
 */

import type {
  ExecutionQuote,
  ExecutionSimulation,
  ExecutionValidation,
  PoolState,
  SimulationStatus,
  TradeSide,
  TransactionState,
  TransactionTransition,
} from './types';
import { buildBestRoute } from './routing-engine';
import { estimateSlippage } from './slippage-engine';
import { assessMevRisk } from './mev';
import { QUOTE_TTL_SECONDS, clamp, isoAfter, round, toTimestamp } from './utils';

export interface QuoteInput {
  chain: string;
  tokenId: string;
  side: TradeSide;
  inputUsd: number;
  pools: PoolState[];
  slippageTolerancePct?: number;
  recentPriceVolatility?: number;
  observedAt: string;
  slot?: number;
}

export function createQuote(input: QuoteInput): ExecutionQuote {
  const slippage = estimateSlippage({
    pools: input.pools,
    side: input.side,
    inputUsd: input.inputUsd,
    recentPriceVolatility: input.recentPriceVolatility,
    observedAt: input.observedAt,
  });

  const route = buildBestRoute({
    pools: input.pools,
    side: input.side,
    inputUsd: input.inputUsd,
    slippagePct: slippage.expectedSlippagePct,
  });

  const tolerance = input.slippageTolerancePct ?? slippage.worstCaseSlippagePct;
  const minimumReceivedUsd = round(route.outputUsd * (1 - clamp(tolerance, 0, 99) / 100), 2);
  const mevRisk = assessMevRisk({
    pools: input.pools,
    side: input.side,
    inputUsd: input.inputUsd,
    chain: input.chain,
  });

  const warnings = buildQuoteWarnings(route, slippage.expectedSlippagePct, mevRisk.level);

  return {
    id: `quote_${input.tokenId}_${input.side}_${Math.round(input.inputUsd)}_${toTimestamp(input.observedAt)}`,
    chain: input.chain,
    tokenId: input.tokenId,
    side: input.side,
    inputUsd: round(input.inputUsd, 2),
    route,
    expectedOutputUsd: route.outputUsd,
    minimumReceivedUsd,
    priceImpactPct: route.priceImpactPct,
    slippagePct: slippage.expectedSlippagePct,
    feeUsd: route.feeUsd,
    gasUsd: route.gasUsd,
    mevRisk,
    warnings,
    isSimulation: true,
    quotedAt: input.observedAt,
    expiresAt: isoAfter(input.observedAt, QUOTE_TTL_SECONDS),
    slot: input.slot,
    confidence: round(clamp(route.confidence * slippage.confidence, 0, 1), 3),
  };
}

/** Is the quote still fresh relative to `nowIso`? (spec §14) */
export function isQuoteFresh(quote: ExecutionQuote, nowIso: string): boolean {
  return toTimestamp(nowIso) < toTimestamp(quote.expiresAt);
}

export interface SimulateInput extends QuoteInput {
  walletUsdBalance?: number;
  walletTokenBalanceUsd?: number;
  minimumOutputUsd?: number;
  /** Pool state hash captured at quote time — detects post-quote pool drift. */
  quotedPoolHash?: string;
  currentPoolHash?: string;
  nowIso?: string;
}

/**
 * Pre-execution simulation with full validation (spec §40, §58). If any check
 * fails, status is a failure and the caller MUST NOT submit.
 */
export function simulateExecution(input: SimulateInput): ExecutionSimulation {
  const quote = createQuote(input);
  const validations: ExecutionValidation[] = [];
  const nowIso = input.nowIso ?? input.observedAt;

  const add = (check: string, passed: boolean, detail: string) =>
    validations.push({ check, passed, detail });

  add('route_exists', quote.route.steps.length > 0, quote.route.steps.length > 0 ? 'Executable route found' : 'No executable route');
  add(
    'liquidity_sufficient',
    quote.expectedOutputUsd > 0 && quote.priceImpactPct < 90,
    `Price impact ${quote.priceImpactPct}%`,
  );
  add('quote_fresh', isQuoteFresh(quote, nowIso), `Quote expires ${quote.expiresAt}`);

  if (input.side === 'SELL') {
    add(
      'token_balance',
      input.walletTokenBalanceUsd == null || input.walletTokenBalanceUsd >= input.inputUsd,
      input.walletTokenBalanceUsd == null ? 'Token balance not provided (skipped)' : `Balance ${input.walletTokenBalanceUsd} vs input ${input.inputUsd}`,
    );
  } else {
    add(
      'wallet_balance',
      input.walletUsdBalance == null || input.walletUsdBalance >= input.inputUsd,
      input.walletUsdBalance == null ? 'Wallet balance not provided (skipped)' : `Balance ${input.walletUsdBalance} vs input ${input.inputUsd}`,
    );
  }

  const slippageOk = input.slippageTolerancePct == null || quote.slippagePct <= input.slippageTolerancePct;
  add('slippage_within_tolerance', slippageOk, `Slippage ${quote.slippagePct}% vs tolerance ${input.slippageTolerancePct ?? 'n/a'}`);

  const minOutputOk = input.minimumOutputUsd == null || quote.minimumReceivedUsd >= input.minimumOutputUsd;
  add('minimum_output', minOutputOk, `Minimum received ${quote.minimumReceivedUsd} vs required ${input.minimumOutputUsd ?? 'n/a'}`);

  const poolUnchanged = input.quotedPoolHash == null || input.currentPoolHash == null || input.quotedPoolHash === input.currentPoolHash;
  add('pool_unchanged', poolUnchanged, poolUnchanged ? 'Pool state stable since quote' : 'Pool state changed after quote');

  const status = deriveStatus(quote, validations, slippageOk, poolUnchanged, isQuoteFresh(quote, nowIso));

  return {
    id: `sim_${quote.id}`,
    chain: input.chain,
    tokenId: input.tokenId,
    side: input.side,
    inputUsd: quote.inputUsd,
    route: quote.route,
    expectedOutputUsd: quote.expectedOutputUsd,
    minimumReceivedUsd: quote.minimumReceivedUsd,
    priceImpactPct: quote.priceImpactPct,
    slippagePct: quote.slippagePct,
    feeUsd: quote.feeUsd,
    gasUsd: quote.gasUsd,
    status,
    warnings: quote.warnings,
    validations,
    quotedAt: quote.quotedAt,
    expiresAt: quote.expiresAt,
  };
}

function deriveStatus(
  quote: ExecutionQuote,
  validations: ExecutionValidation[],
  slippageOk: boolean,
  poolUnchanged: boolean,
  fresh: boolean,
): SimulationStatus {
  if (!fresh) return 'QUOTE_EXPIRED';
  if (!poolUnchanged) return 'POOL_CHANGED';
  if (quote.route.steps.length === 0 || quote.expectedOutputUsd <= 0 || quote.priceImpactPct >= 90) {
    return 'INSUFFICIENT_LIQUIDITY';
  }
  if (!slippageOk) return 'SLIPPAGE_EXCEEDED';
  const balanceFailed = validations.some((v) => (v.check === 'wallet_balance' || v.check === 'token_balance') && !v.passed);
  const minOutputFailed = validations.some((v) => v.check === 'minimum_output' && !v.passed);
  if (balanceFailed || minOutputFailed) return 'VALIDATION_FAILED';
  return 'SIMULATED';
}

function buildQuoteWarnings(route: { priceImpactPct: number; steps: unknown[] }, slippagePct: number, mev: string): string[] {
  const warnings: string[] = [];
  if (route.priceImpactPct >= 10) warnings.push(`High price impact (${round(route.priceImpactPct, 1)}%).`);
  if (slippagePct >= 10) warnings.push(`Elevated expected slippage (${round(slippagePct, 1)}%).`);
  if (route.steps.length === 0) warnings.push('No executable route — order cannot be filled at any size.');
  if (mev === 'HIGH') warnings.push('Elevated MEV risk for this trade size.');
  warnings.push('Quote is an estimate, not a guarantee of execution.');
  return warnings;
}

// ────────────────────────────────────────────────────────────────────────────
// Transaction State Machine (spec §41)
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  CREATED: ['SIMULATING'],
  SIMULATING: ['SIMULATED', 'SIMULATION_FAILED'],
  SIMULATED: ['SUBMITTING', 'EXPIRED'],
  SUBMITTING: ['SUBMITTED', 'SUBMISSION_FAILED', 'REJECTED'],
  SUBMITTED: ['CONFIRMING', 'REJECTED', 'EXPIRED'],
  CONFIRMING: ['CONFIRMED', 'REORGED', 'UNKNOWN'],
  CONFIRMED: [],
  SIMULATION_FAILED: [],
  SUBMISSION_FAILED: [],
  REJECTED: [],
  EXPIRED: [],
  REORGED: [],
  UNKNOWN: [],
};

export class TransactionStateMachine {
  private _state: TransactionState = 'CREATED';
  private _history: TransactionTransition[] = [];

  get state(): TransactionState {
    return this._state;
  }

  get history(): TransactionTransition[] {
    return [...this._history];
  }

  canTransition(to: TransactionState): boolean {
    return ALLOWED_TRANSITIONS[this._state].includes(to);
  }

  transition(to: TransactionState, atIso: string, reason?: string): boolean {
    if (!this.canTransition(to)) return false;
    this._history.push({ from: this._state, to, at: atIso, reason });
    this._state = to;
    return true;
  }

  isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this._state].length === 0;
  }
}
