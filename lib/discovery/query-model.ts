import { z } from 'zod';
import type { DiscoveryFilter } from './types';
import { ApiError } from '@/lib/server/errors';

/**
 * Discovery Query Model (Section 33)
 *
 * Typed Zod schema for all discovery API query parameters.
 * No arbitrary database query strings accepted from clients.
 * All inputs validated through Zod with explicit bounds.
 */

export const timeWindowSchema = z.enum(['1m', '5m', '15m', '1h', '4h', '24h']).default('15m');
export const chainSchema = z.enum(['solana']).default('solana');
export const sortSchema = z.enum([
  'score',
  'trending',
  'volume',
  'liquidity',
  'age',
  'price_change',
  'market_cap',
]).default('score');

/**
 * Query parameters accepted on GET discovery endpoints via URL search params.
 */
export const discoveryQuerySchema = z.object({
  /** Show launches with no pool. Off by default — they cannot be traded. */
  includeZeroLiquidity: z.coerce.boolean().optional(),
  chain: chainSchema,
  timeWindow: timeWindowSchema,
  sort: sortSchema,
  // Bounds carry their own messages: Zod's default for a failed bound is
  // "Invalid input", which tells a caller nothing about what to send instead.
  limit: z.coerce
    .number()
    .int('must be a whole number')
    .min(1, 'must be at least 1')
    .max(100, 'must be 100 or fewer — page with `cursor` for more')
    .default(20),
  offset: z.coerce.number().int('must be a whole number').min(0, 'cannot be negative').default(0),
  cursor: z.string().optional(),
  searchQuery: z.string().optional(),

  // Range filters — all optional, validated numeric bounds
  minMarketCap: z.coerce.number().min(0).optional(),
  maxMarketCap: z.coerce.number().min(0).optional(),
  minLiquidity: z.coerce.number().min(0).optional(),
  maxLiquidity: z.coerce.number().min(0).optional(),
  minVolume: z.coerce.number().min(0).optional(),
  maxVolume: z.coerce.number().min(0).optional(),
  minVolumeChange: z.coerce.number().optional(),
  maxVolumeChange: z.coerce.number().optional(),
  minDiscoveryScore: z.coerce.number().min(0).max(100).optional(),
  maxDiscoveryScore: z.coerce.number().min(0).max(100).optional(),
  minHolderCount: z.coerce.number().int().min(0).optional(),
  maxHolderCount: z.coerce.number().int().min(0).optional(),
  minTokenAge: z.coerce.number().min(0).optional(),
  maxTokenAge: z.coerce.number().optional(),
  minPriceChange: z.coerce.number().optional(),
  maxPriceChange: z.coerce.number().optional(),
  minOrganicScore: z.coerce.number().min(0).max(100).optional(),
  maxTop5Share: z.coerce.number().min(0).max(1).optional(),
  maxTop10Holdings: z.coerce.number().min(0).max(100).optional(),
  maxDevHoldings: z.coerce.number().min(0).max(100).optional(),
  maxSnipers: z.coerce.number().min(0).max(100).optional(),
  maxInsiders: z.coerce.number().min(0).max(100).optional(),
  maxBundlers: z.coerce.number().min(0).max(100).optional(),
  minRiskScore: z.coerce.number().min(0).max(100).optional(),
  mintRenouncedOnly: z.coerce.boolean().optional(),
  liquidityLockedOnly: z.coerce.boolean().optional(),
  noCoordinatedSignals: z.coerce.boolean().optional(),
});

export type DiscoveryQueryParams = z.infer<typeof discoveryQuerySchema>;

/**
 * POST /api/v1/discovery/screen request body schema.
 * Accepts the full filter object via JSON body.
 */
export const discoveryScreenSchema = z.object({
  chain: chainSchema,
  timeWindow: timeWindowSchema,
  sort: sortSchema,
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  cursor: z.string().optional(),
  searchQuery: z.string().optional(),

  minMarketCap: z.number().min(0).optional(),
  maxMarketCap: z.number().min(0).optional(),
  minLiquidity: z.number().min(0).optional(),
  maxLiquidity: z.number().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  maxVolume: z.number().min(0).optional(),
  minVolumeChange: z.number().optional(),
  maxVolumeChange: z.number().optional(),
  minDiscoveryScore: z.number().min(0).max(100).optional(),
  maxDiscoveryScore: z.number().min(0).max(100).optional(),
  minHolderCount: z.number().int().min(0).optional(),
  maxHolderCount: z.number().int().min(0).optional(),
  minTokenAge: z.number().min(0).optional(),
  maxTokenAge: z.number().optional(),
  minPriceChange: z.number().optional(),
  maxPriceChange: z.number().optional(),
  minOrganicScore: z.number().min(0).max(100).optional(),
  maxTop5Share: z.number().min(0).max(1).optional(),
  maxTop10Holdings: z.number().min(0).max(100).optional(),
  maxDevHoldings: z.number().min(0).max(100).optional(),
  maxSnipers: z.number().min(0).max(100).optional(),
  maxInsiders: z.number().min(0).max(100).optional(),
  maxBundlers: z.number().min(0).max(100).optional(),
  minRiskScore: z.number().min(0).max(100).optional(),
  mintRenouncedOnly: z.boolean().optional(),
  liquidityLockedOnly: z.boolean().optional(),
  noCoordinatedSignals: z.boolean().optional(),
});

export type DiscoveryScreenParams = z.infer<typeof discoveryScreenSchema>;

/**
 * Parses URL search params into validated DiscoveryQueryParams.
 * Strips unknown params and applies defaults.
 */
export function parseDiscoveryQuery(url: URL): DiscoveryQueryParams {
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = discoveryQuerySchema.safeParse(raw);
  if (!parsed.success) throw badQuery(parsed.error);
  return parsed.data;
}

/**
 * A rejected query parameter is the caller's fault, and must say so.
 *
 * Every discovery route funnels its parse through here inside a `try` that ends
 * in `new ApiError(..., 500)`. A bare `ZodError` therefore surfaced as
 * `{"code":"INTERNAL_ERROR"}` with a 500 — `?limit=300` (the schema caps it at
 * 100) read as "the server is broken" rather than "that limit is too large",
 * which is both wrong for the caller and noise in error monitoring.
 *
 * Raising an `ApiError` with a 400 fixes every route at once, and names the
 * offending field so the caller can act on it.
 */
function badQuery(error: z.ZodError): ApiError {
  const first = error.issues[0];
  const field = first?.path.join('.') || 'query';
  return new ApiError(
    `Invalid query parameter \`${field}\`: ${first?.message ?? 'failed validation'}`,
    400,
    'INVALID_QUERY',
    error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  );
}

/**
 * Converts validated query params into the internal DiscoveryFilter format.
 */
export function queryToFilter(params: DiscoveryQueryParams | DiscoveryScreenParams) {
  return {
    chain: params.chain,
    timeWindow: params.timeWindow,
    includeZeroLiquidity: (params as { includeZeroLiquidity?: boolean }).includeZeroLiquidity,
    searchQuery: params.searchQuery,
    marketCapMin: params.minMarketCap,
    marketCapMax: params.maxMarketCap,
    liquidityMin: params.minLiquidity,
    liquidityMax: params.maxLiquidity,
    volumeMin: params.minVolume,
    volumeMax: params.maxVolume,
    volumeChangeMin: params.minVolumeChange,
    volumeChangeMax: params.maxVolumeChange,
    discoveryScoreMin: params.minDiscoveryScore,
    discoveryScoreMax: params.maxDiscoveryScore,
    holdersMin: params.minHolderCount,
    holdersMax: params.maxHolderCount,
    ageMinutesMin: params.minTokenAge,
    ageMinutesMax: params.maxTokenAge,
    priceChangeMin: params.minPriceChange,
    priceChangeMax: params.maxPriceChange,
    organicVolumeMin: params.minOrganicScore,
    top5VolumeShareMax: params.maxTop5Share,
    top10HoldingsMax: params.maxTop10Holdings,
    devHoldingsMax: params.maxDevHoldings,
    snipersMax: params.maxSnipers,
    insidersMax: params.maxInsiders,
    bundlersMax: params.maxBundlers,
    minRiskScore: params.minRiskScore,
    mintRenouncedOnly: params.mintRenouncedOnly,
    liquidityLockedOnly: params.liquidityLockedOnly,
    noCoordinatedSignals: params.noCoordinatedSignals,
  };
}

export function filterToQueryParams(filter: Partial<DiscoveryFilter>): Record<string, string> {
  const params: Record<string, string> = {};

  if (filter.chain) params.chain = filter.chain;
  if (filter.timeWindow) params.timeWindow = filter.timeWindow;
  if (filter.searchQuery) params.searchQuery = filter.searchQuery;
  if (filter.marketCapMin !== undefined) params.minMarketCap = String(filter.marketCapMin);
  if (filter.marketCapMax !== undefined) params.maxMarketCap = String(filter.marketCapMax);
  if (filter.liquidityMin !== undefined) params.minLiquidity = String(filter.liquidityMin);
  if (filter.liquidityMax !== undefined) params.maxLiquidity = String(filter.liquidityMax);
  if (filter.volumeMin !== undefined) params.minVolume = String(filter.volumeMin);
  if (filter.volumeMax !== undefined) params.maxVolume = String(filter.volumeMax);
  if (filter.volumeChangeMin !== undefined) params.minVolumeChange = String(filter.volumeChangeMin);
  if (filter.volumeChangeMax !== undefined) params.maxVolumeChange = String(filter.volumeChangeMax);
  if (filter.discoveryScoreMin !== undefined) params.minDiscoveryScore = String(filter.discoveryScoreMin);
  if (filter.discoveryScoreMax !== undefined) params.maxDiscoveryScore = String(filter.discoveryScoreMax);
  if (filter.holdersMin !== undefined) params.minHolderCount = String(filter.holdersMin);
  if (filter.holdersMax !== undefined) params.maxHolderCount = String(filter.holdersMax);
  if (filter.ageMinutesMin !== undefined) params.minTokenAge = String(filter.ageMinutesMin);
  if (filter.ageMinutesMax !== undefined) params.maxTokenAge = String(filter.ageMinutesMax);
  if (filter.priceChangeMin !== undefined) params.minPriceChange = String(filter.priceChangeMin);
  if (filter.priceChangeMax !== undefined) params.maxPriceChange = String(filter.priceChangeMax);
  if (filter.organicVolumeMin !== undefined) params.minOrganicScore = String(filter.organicVolumeMin);
  if (filter.top5VolumeShareMax !== undefined) params.maxTop5Share = String(filter.top5VolumeShareMax);
  if (filter.top10HoldingsMax !== undefined) params.maxTop10Holdings = String(filter.top10HoldingsMax);
  if (filter.devHoldingsMax !== undefined) params.maxDevHoldings = String(filter.devHoldingsMax);
  if (filter.snipersMax !== undefined) params.maxSnipers = String(filter.snipersMax);
  if (filter.insidersMax !== undefined) params.maxInsiders = String(filter.insidersMax);
  if (filter.bundlersMax !== undefined) params.maxBundlers = String(filter.bundlersMax);
  if (filter.minRiskScore !== undefined) params.minRiskScore = String(filter.minRiskScore);
  if (filter.mintRenouncedOnly !== undefined) params.mintRenouncedOnly = String(filter.mintRenouncedOnly);
  if (filter.liquidityLockedOnly !== undefined) params.liquidityLockedOnly = String(filter.liquidityLockedOnly);
  if (filter.noCoordinatedSignals !== undefined) params.noCoordinatedSignals = String(filter.noCoordinatedSignals);

  // Support legacy numeric filter aliases if present.
  if (filter.minLiquidityUsd !== undefined) params.minLiquidity = String(filter.minLiquidityUsd);
  if (filter.minVolumeUsd !== undefined) params.minVolume = String(filter.minVolumeUsd);

  return params;
}
