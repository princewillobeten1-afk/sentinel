import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { summarizeUsage, summarizeByEndpoint } from '@/lib/server/usage-log';

export const dynamic = 'force-dynamic';

/** GET /api/v1/user/usage — powers the developer dashboard's usage panel (Sprint 28 §62-63). */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    return jsonResponse({
      summary: summarizeUsage(user.userId),
      byEndpoint: summarizeByEndpoint(user.userId).slice(0, 20),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load usage', 500));
  }
}
