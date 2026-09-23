export const dynamic = 'force-dynamic';

import { errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

/**
 * POST /api/v1/wallets/withdraw — legacy unsigned withdrawal route is disabled.
 */
export async function POST(request: Request) {
  try {
    await requireAuth(request);
    throw new ApiError('This withdrawal form cannot submit an on-chain transfer. Use the connected wallet Send flow.', 501, 'WALLET_SIGNING_REQUIRED');
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Withdrawal execution failed', 500)
    );
  }
}
