export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { walletService } from '@/lib/auth/wallet-service';
import { ApiError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const wallets = await walletService.getUserWallets(authUser.userId);

    return jsonResponse({
      wallets,
      count: wallets.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Unauthorized', 401));
  }
}
