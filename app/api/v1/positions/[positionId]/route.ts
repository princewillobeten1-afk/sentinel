import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { getPositionById, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/positions/:positionId
 *
 * The central position card (spec §29, §46): token, quantity, cost basis,
 * market value, estimated exit value, realized/unrealized/net P&L, risk,
 * exitability and exposure for a single position.
 *
 * Shares this dynamic segment with the existing protection/emergency-exit
 * routes, so the param name (`positionId`) matches theirs.
 */
export async function GET(request: Request, { params }: { params: { positionId: string } }) {
  try {
    const user = await requireAuth(request);
    const { position } = await getPositionById(user, params.positionId, request);

    return jsonResponse(
      {
        id: position.id,
        token: {
          tokenId: position.tokenId,
          symbol: position.symbol,
          name: position.name,
          chain: position.chain,
          isNative: position.isNative,
        },
        status: position.status,
        quantity: position.quantity,
        wallets: position.wallets,
        costBasis: position.costBasis,
        marketValue: position.valuation.markValue,
        estimatedExitValue: position.valuation.estimatedExitValue,
        stressExitValue: position.valuation.stressExitValue,
        exitDiscountPct: position.valuation.exitDiscountPct,
        realizedPnl: position.pnl.realized,
        unrealizedPnl: position.pnl.unrealized,
        netPnl: position.pnl.net,
        netReturnPct: position.pnl.netReturnPct,
        fees: position.pnl.fees,
        realizedEntries: position.realizedEntries,
        allocationPct: position.allocationPct,
        risk: position.risk,
        exitability: position.exitability,
        liquidityAdjusted: position.liquidityAdjusted,
        pending: position.pending,
        timeline: position.timeline,
        executionCosts: position.executionCosts,
        strategyTags: position.strategyTags,
        firstAcquiredAt: position.firstAcquiredAt,
        lastActivityAt: position.lastActivityAt,
        averageHoldingHours: position.averageHoldingHours,
        limitations: position.limitations,
      },
      200,
      PRIVATE_RESPONSE_HEADERS,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load position', 500));
  }
}
