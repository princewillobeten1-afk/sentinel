import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAdmin } from '@/lib/server/rbac';
import { serverStore } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/audit-log?userId=&action=&since= — filterable audit log. Admin-only. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? undefined;
    const action = url.searchParams.get('action') ?? undefined;
    const since = url.searchParams.get('since') ?? undefined;

    const entries = await serverStore.getAuditLogs({ userId, action, since });
    return jsonResponse({ entries, count: entries.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load audit log', 500));
  }
}
