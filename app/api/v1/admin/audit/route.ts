import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminAuditService } from '@/lib/admin/audit';
import { PermissionDomain } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/audit — query SHA-256 chained audit logs and check cryptographic integrity. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const actorId = url.searchParams.get('actorId') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const domain = (url.searchParams.get('domain') as PermissionDomain) || undefined;
    const resourceType = url.searchParams.get('resourceType') || undefined;
    const verifyIntegrity = url.searchParams.get('verify') === 'true';

    const logs = adminAuditService.query({
      actorId,
      action,
      domain,
      resourceType,
      limit: 100,
    });

    let integrityResult = undefined;
    if (verifyIntegrity) {
      integrityResult = adminAuditService.verifyChainIntegrity();
    }

    return jsonResponse({
      logs,
      count: logs.length,
      totalLogsInSystem: adminAuditService.getTotalCount(),
      integrity: integrityResult,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load audit logs', 500));
  }
}
