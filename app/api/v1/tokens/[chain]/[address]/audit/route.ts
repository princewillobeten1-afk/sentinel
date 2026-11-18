import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getTokenAudit } from '@/lib/trading/audit-service';
import { getRobinhoodTokenAudit } from '@/lib/market/robinhood-token-service';
import { isEvmAddress } from '@/lib/chains/chain-config';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: { chain: string; address: string } | Promise<{ chain: string; address: string }> }
) {
  try {
    const { chain, address } = await Promise.resolve(context.params);
    const normalizedChain = chain.toLowerCase();
    if (normalizedChain === 'robinhood') {
      if (!isEvmAddress(address)) throw new ApiError('A valid Robinhood Chain contract address is required', 400);
      return jsonResponse(await getRobinhoodTokenAudit(address), 200, { 'Cache-Control': 'no-store' });
    }
    if (normalizedChain !== 'solana') throw new ApiError('Token-card audit evidence is available for Solana and Robinhood Chain only', 400);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new ApiError('A token mint address is required', 400);
    return jsonResponse(await getTokenAudit(address), 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token audit', 500));
  }
}
