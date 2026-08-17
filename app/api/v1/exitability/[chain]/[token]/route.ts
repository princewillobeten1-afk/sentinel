import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { MOCK_TOKENS } from '@/lib/mocks/intelligence';
import { getExitabilityContext } from '@/lib/mocks/exitability-mocks';
import { processExitabilityPipeline } from '@/lib/exitability';
import { dispatchExitabilityAlerts } from '@/lib/alerts/dispatch';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/exitability/:chain/:token?amount=5000 (Sprint 28 §22)
 *
 * Position-specific exitability (spec §43). Returns score, confidence, expected
 * output, price impact, slippage, liquidity, active liquidity, route, stress
 * score, curve, exit depth, and warnings.
 *
 * `optionalAuth: true` — same public-compatibility reasoning as the
 * intelligence route; a presented API key still gets full scope/rate-limit/
 * usage-log treatment.
 */
export const GET = withApiGateway(
  async (_ctx, request, params) => {
  try {
    const { chain, token } = params;
    const symbol = token.toUpperCase();

    if (chain !== 'solana') throw new ApiError(`Unsupported chain: ${chain}`, 400, 'UNSUPPORTED_CHAIN');
    if (!MOCK_TOKENS[symbol]) throw new ApiError(`Token not found: ${symbol}`, 404, 'TOKEN_NOT_FOUND');

    const context = getExitabilityContext(symbol);
    if (!context) throw new ApiError(`No exitability data for ${symbol}`, 404, 'NO_DATA');

    const url = new URL(request.url);
    const amountParam = url.searchParams.get('amount');
    const referencePositionUsd = amountParam ? Number(amountParam) : undefined;
    if (amountParam && (!Number.isFinite(referencePositionUsd) || (referencePositionUsd ?? 0) <= 0)) {
      throw new ApiError('amount must be a positive number', 400, 'INVALID_AMOUNT');
    }

    const result = processExitabilityPipeline({ context, referencePositionUsd });
    const { exitability, stress } = result;

    dispatchExitabilityAlerts(result.alertEvents);

    return jsonResponse({
      tokenId: MOCK_TOKENS[symbol].id,
      symbol,
      chain,
      referencePositionUsd: exitability.referencePositionUsd,
      score: exitability.score,
      interpretation: exitability.interpretation,
      confidence: exitability.confidence,
      stressScore: exitability.stressScore,
      expectedOutputUsd: exitability.referenceSimulation.expectedProceedsUsd,
      minimumProceedsUsd: exitability.referenceSimulation.minimumProceedsUsd,
      priceImpactPct: exitability.referenceSimulation.priceImpactPct,
      slippagePct: exitability.referenceSimulation.slippagePct,
      route: exitability.referenceSimulation.route,
      liquidity: exitability.liquidity,
      curve: exitability.curve,
      exitDepth: exitability.exitDepth,
      holderPressure: exitability.holderPressure,
      stress,
      warnings: exitability.warnings,
      explanation: exitability.explanation,
      signals: exitability.signals,
      alertEvents: result.alertEvents,
      isSimulation: true,
      timestamp: exitability.generatedAt,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to compute exitability', 500));
  }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
