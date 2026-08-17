import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { SolanaMarketDataProvider } from '@/lib/market/solana-provider';

export const dynamic = 'force-dynamic';

const provider = new SolanaMarketDataProvider();

/**
 * GET /api/v1/market/live/summary
 *
 * Debug/smoke-test surface for SolanaMarketDataProvider.getMarketSummary().
 */
export async function GET() {
  try {
    const summary = await provider.getMarketSummary();
    return jsonResponse({ summary });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load real market summary', 500));
  }
}
