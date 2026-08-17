import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { AdminGraphEngine } from '@/lib/admin/graph';

export const dynamic = 'force-dynamic';

/** GET /api/v1/admin/graph?id=So111...&type=TOKEN — entity relationship network graph. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || 'So11111111111111111111111111111111111111112';
    const type = (url.searchParams.get('type') || 'TOKEN').toUpperCase();

    const graph = AdminGraphEngine.buildGraph(id, type);
    return jsonResponse({ graph });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to build relationship graph', 500));
  }
}
