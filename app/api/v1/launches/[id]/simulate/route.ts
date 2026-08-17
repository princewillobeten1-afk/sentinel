export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { BondingCurveEngine } from '@/lib/launchpad/bonding-curve';
import { BondingCurveState } from '@/lib/launchpad/types';

const engine = new BondingCurveEngine();

export const POST = withApiGateway(
  async (_ctx, request) => {
    try {
      const body = await request.json();
      const state: BondingCurveState = body.state;
      const action: 'BUY' | 'SELL' = body.action;
      const amount: number = body.amount;

      if (!state || !action || !amount) {
        throw new ApiError('Missing parameters', 400, 'MISSING_PARAMS');
      }

      const result = action === 'BUY' ? engine.simulateBuy(state, amount) : engine.simulateSell(state, amount);

      return jsonResponse(result);
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to simulate bonding curve trade', 500));
    }
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
