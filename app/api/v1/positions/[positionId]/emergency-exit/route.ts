import { errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

/** A position exit must pass through a reviewed, wallet-signed swap. */
export async function POST(request: Request) {
  try {
    await requireAuth(request);
    throw new ApiError('Emergency exit automation is unavailable until it can use a wallet-signed Solana swap.', 501, 'WALLET_SIGNING_REQUIRED');
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Emergency exit unavailable.', 503));
  }
}
