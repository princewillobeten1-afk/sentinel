import { errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
/** Sample endpoints cannot remain a public route around pilot controls. */
export async function retiredAiRoute() {
  return errorResponse(new ApiError('Use the authenticated Copilot workspace for live public-data analysis.',410,'AI_PREVIEW_RETIRED'));
}
