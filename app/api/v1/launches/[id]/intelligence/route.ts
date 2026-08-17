export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { LaunchController } from '@/lib/launchpad/engine';

const controller = new LaunchController();

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    const launchId = params.id;

    if (!launchId) {
      return errorResponse(new ApiError('Launch ID required', 400, 'MISSING_LAUNCH_ID'));
    }

    const intelligence = controller.getLaunchIntelligence(launchId);
    return jsonResponse(intelligence);
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
