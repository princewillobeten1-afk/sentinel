import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { dbRepository } from '@/lib/db/repository';
import { confirmationMonitor } from '@/lib/execution/confirmation-monitor';

export const dynamic = 'force-dynamic';

/** GET /api/v1/transactions/:hash — query transaction status, receipt, and confirmations */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const url = new URL(request.url);
    const chainId = url.searchParams.get('chainId') || 'solana';

    const receipt = dbRepository.getReceiptByHash(hash);
    const confStatus = await confirmationMonitor.monitor(chainId, hash);

    return jsonResponse({
      transactionHash: hash,
      chainId,
      status: confStatus.isConfirmed ? 'CONFIRMED' : 'PENDING',
      confirmation: confStatus,
      receipt: receipt || null,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch transaction details', 500));
  }
}
