import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { getTokenAudit } from '@/lib/trading/audit-service';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { chain: string; address: string } }) {
  try {
    const { chain, address } = params;
    if (chain.toLowerCase() !== 'solana') throw new ApiError('Token-card audit evidence is currently available for Solana only', 400);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw new ApiError('A token mint address is required', 400);
    return jsonResponse(await getTokenAudit(address), 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token audit', 500));
  }
}
