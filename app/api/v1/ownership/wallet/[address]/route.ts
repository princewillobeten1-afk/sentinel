/**
 * Wallet Relationships API
 * GET /api/v1/ownership/wallet/:address
 */

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { MOCK_EDGES } from '@/lib/mocks/ownership-mocks';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    try {
      const { address } = params;

      if (!address) {
        throw new ApiError('Missing required address parameter', 400, 'INVALID_PARAMS');
      }

      const allEdges = Object.values(MOCK_EDGES).flat();
      const walletEdges = allEdges.filter(
        (e) => e.source === address || e.target === address,
      );

      return jsonResponse({
        address,
        relationships: walletEdges,
        count: walletEdges.length,
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  },
  { scopes: ['READ_REPUTATION'], optionalAuth: true },
);
