import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    const trade = {
      id: params.id,
      txHash: '8kL9z2mP1xQ5wN3a19TestSignature001',
      user: user.userId,
      tokenName: 'Solana Sentinel',
      tokenSymbol: 'SENT',
      tokenMint: '7xK99zK8mP2xQ5wN3a19',
      side: 'buy',
      inputAmount: '0.5000 SOL',
      outputAmount: '20.6521 SENT',
      priceUsd: '$3.4500',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      networkFeeSol: '0.000005 SOL',
      route: 'Orca Whirlpools → Raydium CLMM',
      provider: 'Jupiter Aggregator',
      explorerUrl: 'https://solscan.io/tx/8kL9z2mP1xQ5wN3a19TestSignature001',
    };

    return jsonResponse({ trade });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Trade record not found', 404));
  }
}
