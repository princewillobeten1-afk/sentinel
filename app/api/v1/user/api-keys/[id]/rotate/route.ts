import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { requireAuth } from '@/lib/server/auth';
import { apiKeyStore } from '@/lib/server/api-keys';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/user/api-keys/:id/rotate (Sprint 28 §9)
 *
 * Invalidates the old secret immediately and returns a fresh one under the
 * same key id/name/scopes — so a leaked secret can be cut off without
 * having to recreate and re-permission a key from scratch.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(request);
    const rotated = apiKeyStore.rotate(params.id, user.userId);
    if (!rotated) throw new ApiError('API key not found or not active', 404, 'API_KEY_NOT_FOUND');

    return jsonResponse({
      key: rotated.key,
      secret: rotated.secret,
      notice: 'The previous secret is now invalid. Store this new secret — it is shown only once.',
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to rotate API key', 500));
  }
}
