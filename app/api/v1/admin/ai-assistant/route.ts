import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { AdminAiInvestigationAssistant } from '@/lib/admin/ai-assistant';

export const dynamic = 'force-dynamic';

/** POST /api/v1/admin/ai-assistant — query AI investigation assistant for grounded operational briefings. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = body.query || 'Summarize active token activity';
    const contextId = body.contextId;

    const analysis = await AdminAiInvestigationAssistant.analyze(query, contextId);
    return jsonResponse({ analysis });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('AI Investigation Assistant failed', 500));
  }
}
