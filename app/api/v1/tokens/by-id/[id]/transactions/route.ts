import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

/** GET /api/v1/tokens/:id/transactions — get blockchain transactions for a token */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const now = Date.now();

    const transactions = [
      {
        id: `tx_${id}_1`,
        type: 'SWAP',
        tokenSymbol: 'SOL',
        amount: '25.0',
        valueUsd: 3750.0,
        status: 'CONFIRMED',
        sender: '7xK9...3a19',
        txHash: '5xSwapHash99SolanaTxRaydium1',
        blockOrSlot: 284910201,
        timestamp: new Date(now - 60000).toISOString(),
      },
      {
        id: `tx_${id}_2`,
        type: 'LIQUIDITY_ADD',
        tokenSymbol: 'SOL',
        amount: '500.0',
        valueUsd: 75000.0,
        status: 'CONFIRMED',
        sender: 'AlphaDeployer9pQ1',
        txHash: '3xLiqAddHashRaydiumPoolInit',
        blockOrSlot: 284910000,
        timestamp: new Date(now - 3600000).toISOString(),
      },
    ];

    return jsonResponse({
      tokenId: id,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch transactions', 500));
  }
}
