import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { isEvmAddress } from '@/lib/chains/chain-config';
import { toInsightXNetwork } from '@/lib/insightx/atlas-embed';
import { fetchInsightXTokenIntelligence } from '@/lib/insightx/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tokens/:chain/:address/insightx
 *
 * Returns InsightX Atlas Live embed URL alongside DEX Metrics, Distribution,
 * Wallet Clusters, Sniper/Bundler/Insider analytics, and Scanner score when
 * `INSIGHTX_API_KEY` is configured.
 */
export async function GET(
  request: Request,
  context: { params: { chain: string; address: string } | Promise<{ chain: string; address: string }> },
) {
  try {
    const { chain, address } = await Promise.resolve(context.params);
    const normChain = (chain ?? '').trim().toLowerCase();
    const cleanAddress = (address ?? '').trim();
    const network = toInsightXNetwork(normChain);
    const mode = new URL(request.url).searchParams.get('detail') === 'full' ? 'full' : 'core';

    if (network === 'robinhood') {
      if (!isEvmAddress(cleanAddress)) {
        throw new ApiError('A valid Robinhood Chain token address is required', 400);
      }
    } else if (network === 'sol') {
      if (!cleanAddress || cleanAddress.length < 32) {
        throw new ApiError('A token mint address is required', 400);
      }
    } else if (!cleanAddress || (!isEvmAddress(cleanAddress) && cleanAddress.length < 20)) {
      throw new ApiError('A valid token address is required', 400);
    }

    const intelligence = await fetchInsightXTokenIntelligence(normChain, cleanAddress, { mode });
    return jsonResponse(intelligence as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch InsightX intelligence', 500),
    );
  }
}
