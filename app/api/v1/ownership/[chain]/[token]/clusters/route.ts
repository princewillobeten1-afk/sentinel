/**
 * Ownership Clusters API
 * GET /api/v1/ownership/:chain/:token/clusters
 */

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { MOCK_CLUSTERS } from '@/lib/mocks/ownership-mocks';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    try {
      const { chain, token } = params;

      if (!chain || !token) {
        throw new ApiError('Missing required parameters', 400, 'INVALID_PARAMS');
      }

      const clusters = MOCK_CLUSTERS[token.toUpperCase()] ?? [];
      return jsonResponse({ clusters, count: clusters.length });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  },
  { scopes: ['READ_REPUTATION'], optionalAuth: true },
);
