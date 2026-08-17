/**
 * Ownership Report API
 * GET /api/v1/ownership/:chain/:token
 */

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { computeOwnershipReport } from '@/lib/ownership/context-builder';

export const dynamic = 'force-dynamic';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    try {
      const { chain, token } = params;

      if (!chain || !token) {
        throw new ApiError('Missing required parameters', 400, 'INVALID_PARAMS');
      }

      // Real engine (calculateEffectiveOwnership), run against raw mock holder/
      // cluster data — not a pre-computed literal (Sprint 28 orphaned-engine wiring).
      const report = computeOwnershipReport(token);
      if (!report) {
        throw new ApiError(`No ownership data found for ${token}`, 404, 'NOT_FOUND');
      }

      return jsonResponse(report);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new Error(String(error)));
    }
  },
  { scopes: ['READ_REPUTATION'], optionalAuth: true },
);
