export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { walletService } from '@/lib/auth/wallet-service';
import { authorizationService } from '@/lib/auth/authorization-service';
import { ApiError } from '@/lib/server/errors';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const authUser = await requireAuth(request);

    if (!await authorizationService.canAccessWallet(authUser.userId, params.id)) {
      throw new ApiError('Wallet not found or not owned by caller', 404, 'WALLET_NOT_FOUND');
    }

    const updatedWallet = await walletService.setDefaultWallet(authUser.userId, params.id);
    return jsonResponse({
      success: true,
      wallet: updatedWallet,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to set default wallet', 400));
  }
}
