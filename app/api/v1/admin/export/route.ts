import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { AdminDataExportService } from '@/lib/admin/data-export';
import { adminAuditService } from '@/lib/admin/audit';
import { AdminRole } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

/** POST /api/v1/admin/export — export sanitized administrative data (CSV/JSON) with role-based PII masking. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dataset = 'AUDIT_LOGS', format = 'json', requestingRole = 'ADMIN' as AdminRole } = body;

    if (dataset === 'AUDIT_LOGS') {
      const logs = adminAuditService.query({ limit: 500 });
      const exported = AdminDataExportService.exportAuditLogs(logs, requestingRole, format);
      return jsonResponse({ data: exported, format, count: logs.length });
    }

    throw new ApiError(`Unsupported export dataset: ${dataset}`, 400);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Export failed', 500));
  }
}
