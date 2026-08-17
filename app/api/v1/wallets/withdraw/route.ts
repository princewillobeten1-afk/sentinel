export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { transferService, WithdrawalRequest } from '@/lib/wallet/transfer-service';

/**
 * POST /api/v1/wallets/withdraw — executes a cryptocurrency withdrawal.
 */
export async function POST(request: Request) {
  try {
    let userId = 'user_001';
    try {
      const authUser = await requireAuth(request);
      userId = authUser.userId;
    } catch {
      // Allow demo user fallback if no auth header passed
    }

    const body = await request.json();
    const {
      walletId = 'w_001',
      walletAddress,
      destinationAddress,
      asset = 'SOL',
      amount,
      network = 'solana',
      priorityFeeTier = 'normal',
    } = body;

    if (!walletAddress || !destinationAddress || typeof amount !== 'number') {
      throw new ApiError(
        'Missing required fields: walletAddress, destinationAddress, and amount are required.',
        400,
        'INVALID_WITHDRAWAL_REQUEST'
      );
    }

    const withdrawalReq: WithdrawalRequest = {
      walletId,
      walletAddress,
      destinationAddress,
      asset,
      amount,
      network,
      priorityFeeTier,
    };

    const result = await transferService.executeWithdrawal(userId, withdrawalReq);
    return jsonResponse(result, 200);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Withdrawal execution failed', 500)
    );
  }
}
