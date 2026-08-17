import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getTokenByMint } from '@/lib/token/search-service';
import { realtimeRepository } from '@/lib/server/db/realtime-repository';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;
    let token = getTokenByMint(address);

    if (!token) {
      const real = await realtimeRepository.getTokenByMint(address);
      if (real) {
        token = {
          id: real.mint,
          mint: real.mint,
          name: real.name || `Token ${real.mint.slice(0, 4)}`,
          symbol: real.symbol || real.mint.slice(0, 4).toUpperCase(),
          chain: chain.toLowerCase(),
          source: (real.platform || 'Pump.fun') as any,
          priceUsd: String(real.priceUsd || 0.0001),
          volume24hUsd: String(real.volume24hUsd || 1000),
          liquidityUsd: String(real.liquidityUsd || 5000),
          marketCapUsd: String(real.marketCapUsd || 20000),
        } as any;
      }
    }

    if (!token) {
      throw new ApiError(`Token '${address}' not found on chain '${chain}'`, 404, 'TOKEN_NOT_FOUND');
    }

    return jsonResponse({
      token: {
        ...token,
        chain: chain.toLowerCase(),
        description: 'Sentinel normalized token record.',
        explorerUrl: `https://solscan.io/token/${address}`,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token', 500));
  }
}
