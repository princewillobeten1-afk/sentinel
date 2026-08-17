import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAdmin } from '@/lib/server/rbac';
import { summarizeUsagePlatformWide, summarizeByEndpointPlatformWide } from '@/lib/server/usage-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/usage/latency — platform-wide p50/p95/p99 latency,
 * unfiltered by user. Admin-only (Sprint 31 — Item 5).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    return jsonResponse({
      summary: summarizeUsagePlatformWide(),
      byEndpoint: summarizeByEndpointPlatformWide().slice(0, 20),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load platform latency', 500));
  }
}
