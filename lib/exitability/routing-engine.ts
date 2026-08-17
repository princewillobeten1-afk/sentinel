/**
 * DEX Routing Engine (spec §11, §12, §13)
 *
 * Builds candidate routes across pools and ranks them by a composite score —
 * not by raw output alone. A single order can be split across pools to reduce
 * aggregate price impact.
 */

import type {
  ExecutionRoute,
  PoolState,
  RouteStep,
  TradeSide,
} from './types';
import { adapterForPool } from './amm';
import { DEFAULT_GAS_USD, clamp, round } from './utils';

export interface RouteInput {
  pools: PoolState[];
  side: TradeSide;
  inputUsd: number;
  slippagePct: number;
  routeId?: string;
}

/** Build the best executable route for an order. */
export function buildBestRoute(input: RouteInput): ExecutionRoute {
  const candidates = buildCandidateRoutes(input);
  candidates.sort((a, b) => b.routeScore - a.routeScore);
  return candidates[0] ?? emptyRoute(input);
}

export function buildCandidateRoutes(input: RouteInput): ExecutionRoute[] {
  const pools = input.pools.filter((pool) => pool.tvlUsd > 0);
  if (pools.length === 0) return [emptyRoute(input)];

  const routes: ExecutionRoute[] = [];

  // 1. Single-pool routes.
  for (const pool of pools) {
    routes.push(singlePoolRoute(pool, input));
  }

  // 2. Split route across the deepest pools, weighted by usable liquidity.
  if (pools.length >= 2) {
    routes.push(splitRoute(pools, input));
  }

  return routes;
}

function singlePoolRoute(pool: PoolState, input: RouteInput): ExecutionRoute {
  const adapter = adapterForPool(pool);
  const quote = input.side === 'SELL'
    ? adapter.quoteSell(pool, input.inputUsd)
    : adapter.quoteBuy(pool, input.inputUsd);

  const step: RouteStep = {
    poolId: pool.poolId,
    dex: pool.dex,
    kind: pool.kind,
    inputUsd: input.inputUsd,
    outputUsd: quote.outputUsd,
    priceImpactPct: quote.priceImpactPct,
    feeUsd: quote.feeUsd,
  };

  return finalizeRoute([step], quote.confidence, input, `${input.routeId ?? 'route'}_${pool.poolId}`);
}

function splitRoute(pools: PoolState[], input: RouteInput): ExecutionRoute {
  const ranked = [...pools]
    .map((pool) => ({ pool, usable: adapterForPool(pool).usableLiquidityUsd(pool) }))
    .sort((a, b) => b.usable - a.usable)
    .slice(0, 3);

  const totalUsable = ranked.reduce((total, entry) => total + entry.usable, 0) || 1;
  const steps: RouteStep[] = [];
  let confidenceSum = 0;

  for (const { pool, usable } of ranked) {
    const portion = input.inputUsd * (usable / totalUsable);
    if (portion <= 0) continue;
    const adapter = adapterForPool(pool);
    const quote = input.side === 'SELL'
      ? adapter.quoteSell(pool, portion)
      : adapter.quoteBuy(pool, portion);
    steps.push({
      poolId: pool.poolId,
      dex: pool.dex,
      kind: pool.kind,
      inputUsd: round(portion, 2),
      outputUsd: quote.outputUsd,
      priceImpactPct: quote.priceImpactPct,
      feeUsd: quote.feeUsd,
    });
    confidenceSum += quote.confidence;
  }

  const avgConfidence = steps.length ? confidenceSum / steps.length : 0.4;
  return finalizeRoute(steps, avgConfidence * 0.97, input, `${input.routeId ?? 'route'}_split`);
}

function finalizeRoute(
  steps: RouteStep[],
  confidence: number,
  input: RouteInput,
  id: string,
): ExecutionRoute {
  const inputUsd = steps.reduce((total, step) => total + step.inputUsd, 0);
  const grossOutput = steps.reduce((total, step) => total + step.outputUsd, 0);
  const feeUsd = round(steps.reduce((total, step) => total + step.feeUsd, 0), 2);
  const gasUsd = round(DEFAULT_GAS_USD * Math.max(1, steps.length), 4);
  const outputUsd = round(Math.max(0, grossOutput - gasUsd), 2);

  // Aggregate price impact is output-weighted across steps.
  const priceImpactPct = round(
    steps.reduce((total, step) => total + step.priceImpactPct * (step.outputUsd / Math.max(grossOutput, 1e-9)), 0),
    4,
  );

  const routeScore = computeRouteScore({ outputUsd, feeUsd, gasUsd, priceImpactPct, confidence });

  return {
    id,
    side: input.side,
    steps,
    inputUsd: round(inputUsd, 2),
    outputUsd,
    priceImpactPct,
    slippagePct: input.slippagePct,
    feeUsd,
    gasUsd,
    confidence: round(clamp(confidence, 0, 1), 3),
    routeScore,
  };
}

/**
 * Composite ranking (spec §12): reward net output and reliability, penalize
 * impact, fees, and gas. Not raw output alone.
 */
function computeRouteScore(args: {
  outputUsd: number;
  feeUsd: number;
  gasUsd: number;
  priceImpactPct: number;
  confidence: number;
}): number {
  const net = args.outputUsd - args.feeUsd - args.gasUsd;
  const impactPenalty = 1 - Math.min(0.9, args.priceImpactPct / 100);
  return round(net * impactPenalty * (0.6 + 0.4 * args.confidence), 4);
}

function emptyRoute(input: RouteInput): ExecutionRoute {
  return {
    id: `${input.routeId ?? 'route'}_empty`,
    side: input.side,
    steps: [],
    inputUsd: round(input.inputUsd, 2),
    outputUsd: 0,
    priceImpactPct: 99.99,
    slippagePct: input.slippagePct,
    feeUsd: 0,
    gasUsd: 0,
    confidence: 0,
    routeScore: 0,
  };
}
