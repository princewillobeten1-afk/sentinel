import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';
import { getExitabilityContext } from '@/lib/mocks/exitability-mocks';
import { analyzeLiquidityQuality } from '@/lib/exitability';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/liquidity/:chain/:token
 *
 * Pools, TVL, active liquidity, pool depth, liquidity changes, concentration,
 * and stability (spec §45).
 */
export async function GET(
  _request: Request,
  { params }: { params: { chain: string; token: string } },
) {
  try {
    const { chain, token } = params;
    const symbol = token.toUpperCase();

    if (chain !== 'solana') throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    if (!MOCK_TOKENS[symbol]) throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');

    const context = getExitabilityContext(symbol);
    if (!context) throw new ApiError(`No liquidity data for ${symbol}`, 404, 'NO_DATA');

    const liquidity = analyzeLiquidityQuality(context);

    return jsonResponse({
      tokenId: MOCK_TOKENS[symbol].id,
      symbol,
      chain,
      pools: context.pools.map((pool) => ({
        poolId: pool.poolId,
        dex: pool.dex,
        kind: pool.kind,
        tvlUsd: pool.tvlUsd,
        activeLiquidityUsd: pool.activeLiquidityUsd,
        feeTierPct: pool.feeTierPct,
        lpLocked: pool.lpLocked,
        ageHours: pool.ageHours,
      })),
      liquidity,
      timestamp: context.observedAt,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch liquidity data', 500));
  }
}
