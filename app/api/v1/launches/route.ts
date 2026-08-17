export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { LaunchController } from '@/lib/launchpad/engine';
import { LaunchConfig } from '@/lib/launchpad/types';
import { killSwitch } from '@/lib/server/kill-switch';

const controller = new LaunchController();

/**
 * Previously fully public with no auth/scope check — a combined
 * analyze-and-deploy action gated only by a body flag. `CREATE_LAUNCH` is a
 * dangerous scope, never auto-granted (see `lib/server/scopes.ts`), and the
 * `creatorWallet` field now defaults to the authenticated user's own wallet
 * instead of a hardcoded placeholder.
 */
export const POST = withApiGateway(
  async (ctx, request) => {
    try {
      const body = await request.json();
      const config: LaunchConfig = body.config;
      const creatorWallet: string = body.creatorWallet || ctx.user.primaryWalletAddress || '';

      if (!config) {
        throw new ApiError('Launch config required', 400, 'MISSING_CONFIG');
      }

      // Preflight analysis
      const risk = await controller.preflightAnalysis(config, creatorWallet);

      if (body.action === 'ANALYZE') {
        return jsonResponse({ risk });
      }

      // Actually Deploy
      if (body.action === 'DEPLOY') {
        if (killSwitch.isPaused('LAUNCHPAD')) {
          throw new ApiError('Launchpad deployments are currently paused platform-wide.', 503, 'LAUNCHPAD_PAUSED');
        }
        if (risk.riskLevel === 'CRITICAL') {
          return jsonResponse({ error: 'Launch rejected due to critical risk factors.', risk }, 403);
        }
        const deployment = await controller.deployLaunch(config);
        return jsonResponse({ deployment, risk });
      }

      throw new ApiError('Invalid action', 400, 'INVALID_ACTION');
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to process launch request', 500));
    }
  },
  { scopes: ['CREATE_LAUNCH'], allowSessionAuth: true, idempotent: true },
);

export const GET = withApiGateway(
  async () => {
    // Stub for Discovery Feed
    return jsonResponse({
      launches: [
        {
          id: 'launch_mock_1',
          name: 'Mock Token Alpha',
          symbol: 'MOCKA',
          marketCap: '$220K',
          liquidity: '$72K',
          adjustedMomentum: 83,
          risk: 'LOW',
          age: '12m',
        },
      ],
    });
  },
  { scopes: ['READ_MARKET_DATA'], optionalAuth: true },
);
