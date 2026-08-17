import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminHealthService } from '@/lib/admin/health';
import { adminEmergencyEngine } from '@/lib/admin/emergency';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/overview — platform overview KPIs, system health matrix, critical alerts, operations feed. */
export async function GET() {
  try {
    const kpis = adminHealthService.getPlatformOverviewKpi();
    const services = adminHealthService.getServiceHealth();
    const metrics = adminHealthService.getInfrastructureMetrics();
    const alerts = adminHealthService.getCriticalAlerts();
    const feed = adminHealthService.getOperationsFeed();
    const emergencyState = adminEmergencyEngine.getState();

    return jsonResponse({
      kpis,
      services,
      metrics,
      alerts,
      feed,
      emergencyState,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load admin overview', 500));
  }
}
