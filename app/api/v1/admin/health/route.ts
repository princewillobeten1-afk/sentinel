import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminHealthService } from '@/lib/admin/health';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/health — detailed infrastructure metrics, blockchain status, and reorg detection. */
export async function GET() {
  try {
    const services = adminHealthService.getServiceHealth();
    const metrics = adminHealthService.getInfrastructureMetrics();
    const blockchains = adminHealthService.getBlockchainInfrastructure();

    return jsonResponse({
      services,
      metrics,
      blockchains,
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load health telemetry', 500));
  }
}
