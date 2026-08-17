import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { apiKeyStore } from '@/lib/server/api-keys';

export const dynamic = 'force-dynamic';

/** GET /api/v1/user/api-keys/:id */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const key = apiKeyStore.getForUser(params.id, user.userId);
    if (!key) throw new ApiError('API key not found', 404, 'API_KEY_NOT_FOUND');
    return jsonResponse({ key });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load API key', 500));
  }
}

/** DELETE /api/v1/user/api-keys/:id — revokes immediately and irreversibly. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const revoked = apiKeyStore.revoke(params.id, user.userId);
    if (!revoked) throw new ApiError('API key not found or already revoked', 404, 'API_KEY_NOT_FOUND');
    return jsonResponse({ revoked: true, id: params.id });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to revoke API key', 500));
  }
}
