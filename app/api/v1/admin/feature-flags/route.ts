import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { adminFeatureFlagService } from '@/lib/admin/feature-flags';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/feature-flags — list all dynamic feature flags and rollout targets. */
export async function GET() {
  try {
    const flags = adminFeatureFlagService.getAllFlags();
    return jsonResponse({ flags, count: flags.length });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load feature flags', 500));
  }
}

/** POST /api/v1/admin/feature-flags — create or update feature flag. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { flag, updatedBy = 'admin_duty', updatedByRole = 'SUPER_ADMIN', reason = 'Feature flag adjustment' } = body;

    const updated = adminFeatureFlagService.setFlag(flag, {
      updatedBy,
      updatedByRole,
      reason,
    });

    return jsonResponse({ flag: updated });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to update feature flag', 500));
  }
}
