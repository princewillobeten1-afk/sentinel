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
    const walletAddress = searchParams.get('address');
    if (!walletAddress) throw new ApiError('A connected wallet address is required for deposit instructions.', 400, 'WALLET_ADDRESS_REQUIRED');
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
 * POST /api/v1/wallets/deposit — unavailable until on-chain indexing records deposits.
 */
export async function POST(request: Request) {
  try {
    await requireAuth(request);
    throw new ApiError('Deposits are recorded from confirmed on-chain transfers, not submitted through this endpoint.', 501, 'ONCHAIN_DEPOSIT_REQUIRED');
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Deposit processing failed', 500)
    );
  }
}
