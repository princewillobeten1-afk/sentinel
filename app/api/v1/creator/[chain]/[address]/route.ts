/**
 * Creator Entity API
 * GET /api/v1/creator/:chain/:address
 */

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { computeCreatorEntity } from '@/lib/creator/context-builder';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    try {
      const { chain, address } = params;

      if (!chain || !address) {
        throw new ApiError('Missing required parameters', 400, 'INVALID_PARAMS');
      }

      // Match symbol or primary address
      let creator = computeCreatorEntity(address);
      if (!creator) {
        // Search by primaryAddress or token symbol in mock entities
        const symbols = ['SENT', 'QUANT', 'BONK', 'ALPHA'];
        for (const sym of symbols) {
          const entity = computeCreatorEntity(sym);
          if (entity && (entity.primaryAddress === address || entity.creatorId.includes(address))) {
            creator = entity;
            break;
          }
        }
      }

      if (!creator) {
        throw new ApiError(`No creator entity found for ${address}`, 404, 'NOT_FOUND');
      }

      return jsonResponse(creator);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  },
  { scopes: ['READ_REPUTATION'], optionalAuth: true },
);
