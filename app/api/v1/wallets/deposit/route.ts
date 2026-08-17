export const dynamic = 'force-dynamic';

import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import { transferService } from '@/lib/wallet/transfer-service';

/**
 * GET /api/v1/wallets/deposit — returns deposit instructions & QR payload for an address.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address') || '7xK99zK8mP2xQ5wN3a19';
    const network = (searchParams.get('network') || 'solana') as any;
    const asset = searchParams.get('asset') || 'SOL';

    const details = transferService.getDepositDetails(walletAddress, network, asset);
    return jsonResponse(details, 200);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to generate deposit details', 500)
    );
  }
}

/**
 * POST /api/v1/wallets/deposit — simulates an inbound deposit in test/demo mode.
 */
export async function POST(request: Request) {
  try {
    let userId = 'user_001';
    try {
      const authUser = await requireAuth(request);
      userId = authUser.userId;
    } catch {
      // Demo fallback
    }

    const body = await request.json();
    const {
      walletId = 'w_001',
      walletAddress,
      asset = 'SOL',
      amount,
      network = 'solana',
      sourceAddress,
    } = body;

    if (!walletAddress || typeof amount !== 'number') {
      throw new ApiError(
        'Missing required fields: walletAddress and amount are required.',
        400,
        'INVALID_DEPOSIT_REQUEST'
      );
    }

    const txItem = await transferService.simulateDeposit(userId, {
      walletId,
      walletAddress,
      asset,
      amount,
      network,
      sourceAddress,
    });

    return jsonResponse(txItem, 200);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Deposit processing failed', 500)
    );
  }
}
