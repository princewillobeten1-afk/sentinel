export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { walletService } from '@/lib/auth/wallet-service';
import { authorizationService } from '@/lib/auth/authorization-service';
import { ApiError } from '@/lib/server/errors';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    return jsonResponse({
      wallet: {
        id,
        address: id,
        tracked: true,
        label: `Wallet ${id.slice(0, 4)}...${id.slice(-4)}`,
        firstSeenAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch wallet', 500));
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const authUser = await requireAuth(request);

    if (!(await authorizationService.canAccessWallet(authUser.userId, params.id))) {
      throw new ApiError('Wallet not found or not owned by caller', 404, 'WALLET_NOT_FOUND');
    }

    const result = await walletService.disconnectWallet(authUser.userId, params.id);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to disconnect wallet', 400));
  }
}
