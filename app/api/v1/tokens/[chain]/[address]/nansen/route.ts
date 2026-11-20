import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { isEvmAddress } from '@/lib/chains/chain-config';
import { toNansenChain } from '@/lib/nansen/chains';
import { fetchNansenTokenSmartMoney } from '@/lib/nansen/client';
import type { NansenTgmTimeframe, NansenTokenDetailLevel } from '@/lib/nansen/types';

export const dynamic = 'force-dynamic';

const VALID_TIMEFRAMES = new Set<NansenTgmTimeframe>(['5m', '1h', '6h', '12h', '1d', '7d']);
const VALID_DETAILS = new Set<NansenTokenDetailLevel>(['core', 'trades', 'holders']);

/**
 * GET /api/v1/tokens/:chain/:address/nansen
 *
 * Returns token-level Nansen Smart Money Flow Intelligence, top Smart Money buyers/sellers,
 * Smart Money DEX swaps, and Smart Money holders across Solana, Robinhood Chain, and EVM.
 */
export async function GET(
  request: Request,
  context: { params: { chain: string; address: string } | Promise<{ chain: string; address: string }> },
) {
  try {
    const { chain, address } = await Promise.resolve(context.params);
    const normChain = (chain ?? '').trim().toLowerCase();
    const cleanAddress = (address ?? '').trim();
    const nansenChain = toNansenChain(normChain);

    if (nansenChain === 'robinhood') {
      if (!isEvmAddress(cleanAddress)) {
        throw new ApiError('A valid Robinhood Chain token address is required', 400);
      }
    } else if (nansenChain === 'solana') {
      if (!cleanAddress || cleanAddress.length < 32) {
        throw new ApiError('A token mint address is required', 400);
      }
    } else if (!cleanAddress || (!isEvmAddress(cleanAddress) && cleanAddress.length < 20)) {
      throw new ApiError('A valid token address is required', 400);
    }

    const url = new URL(request.url);
    const rawTf = (url.searchParams.get('timeframe') ?? '1d').trim().toLowerCase() as NansenTgmTimeframe;
    const rawDetail = (url.searchParams.get('detail') ?? 'core').trim().toLowerCase() as NansenTokenDetailLevel;

    const timeframe: NansenTgmTimeframe = VALID_TIMEFRAMES.has(rawTf) ? rawTf : '1d';
    const detail: NansenTokenDetailLevel = VALID_DETAILS.has(rawDetail) ? rawDetail : 'core';

    const result = await fetchNansenTokenSmartMoney(nansenChain, cleanAddress, { timeframe, detail });
    return jsonResponse(result as unknown as Record<string, unknown>);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error : new ApiError('Failed to fetch token Smart Money data', 500),
    );
  }
}
