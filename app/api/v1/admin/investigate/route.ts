import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { AdminInvestigationService } from '@/lib/admin/investigation';
import { InvestigationEntityType } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/investigate?type=TOKEN&id=So111... — 360° entity dossier. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'TOKEN').toUpperCase() as InvestigationEntityType;
    const id = url.searchParams.get('id') || 'So11111111111111111111111111111111111111112';

    const dossier = await AdminInvestigationService.investigateEntity(type, id);
    return jsonResponse({ dossier });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to compile investigation dossier', 500));
  }
}
