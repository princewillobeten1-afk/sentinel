import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { getPortfolioForWallet, PRIVATE_RESPONSE_HEADERS } from '@/lib/portfolio/service';
import { sortPositions, type PositionSortKey } from '@/lib/portfolio/pipeline';

export const dynamic = 'force-dynamic';

const SORT_KEYS: PositionSortKey[] = ['VALUE', 'PNL', 'RISK', 'ALLOCATION', 'EXITABILITY'];

/**
 * GET /api/v1/portfolio/:wallet/positions?sort=RISK&direction=desc&status=OPEN
 *
 * Position table (spec §45, §59): every open/closed position with value, P&L,
 * allocation, risk and exitability, sortable by any column.
 */
export const GET = withApiGateway(
  async (ctx, request, params) => {
  try {
    const result = await getPortfolioForWallet({ user: ctx.user, wallet: params.wallet, request });

    const url = new URL(request.url);
    const sortParam = (url.searchParams.get('sort') ?? 'VALUE').toUpperCase();
    const direction = url.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
    const statusFilter = url.searchParams.get('status')?.toUpperCase();

    if (!SORT_KEYS.includes(sortParam as PositionSortKey)) {
      throw new ApiError(`Invalid sort key. Use one of: ${SORT_KEYS.join(', ')}`, 400, 'INVALID_SORT');
    }

    let positions = result.positions;
    if (statusFilter && ['OPEN', 'CLOSED', 'DUST'].includes(statusFilter)) {
      positions = positions.filter((position) => position.status === statusFilter);
    }

    const sorted = sortPositions(positions, sortParam as PositionSortKey, direction);

    return jsonResponse(
      {
        positions: sorted,
        count: sorted.length,
        sort: sortParam,
        direction,
      },
      200,
      PRIVATE_RESPONSE_HEADERS,
    );
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load positions', 500));
  }
  },
  { scopes: ['READ_PORTFOLIO'], allowSessionAuth: true },
);
