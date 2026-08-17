import { jsonResponse, errorResponse } from '@/lib/server/api';
import { TraderCopilot } from '@/lib/ai/copilot';
import { CopilotContext } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, context = {} as CopilotContext, isSearchTranslation = false } = body;

    if (!query) {
      return jsonResponse({ error: 'Query is required for Copilot interaction' }, 400);
    }

    if (isSearchTranslation) {
      const searchTranslation = TraderCopilot.translateSearchQuery(query);
      return jsonResponse({
        type: 'search_translation',
        translation: searchTranslation,
      });
    }

    const copilotResponse = await TraderCopilot.handleContextualQuery({
      query,
      context,
    });

    return jsonResponse({
      type: 'copilot_response',
      query,
      response: copilotResponse,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
