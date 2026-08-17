import { jsonResponse, errorResponse } from '@/lib/server/api';
import { requireAuth } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    const trades = [
      {
        id: 'tx_001',
        txHash: '8kL9z2mP1xQ5wN3a19TestSignature001',
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
      },
      {
        id: 'tx_002',
        txHash: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19Sig002',
        tokenName: 'Bonk Doge',
        tokenSymbol: 'BONK',
        tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        side: 'buy',
        inputAmount: '1.2000 SOL',
        outputAmount: '6,009,490.33 BONK',
        priceUsd: '$0.00002845',
        status: 'confirmed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        networkFeeSol: '0.000005 SOL',
        route: 'Raydium CLMM',
        provider: 'Jupiter Aggregator',
        explorerUrl: 'https://solscan.io/tx/3mR8z9K2xP5wN1a84mP2xQ5wN3a19Sig002',
      },
    ];

    return jsonResponse({
      userId: user.userId,
      trades,
      count: trades.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch trade history', 500));
  }
}
