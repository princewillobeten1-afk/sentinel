import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { ohlcvEngine } from '@/lib/market-data/ohlcv/ohlcv-engine';
import { CandleInterval } from '@/lib/market-data/types';

export const dynamic = 'force-dynamic';

/** GET /api/v1/markets/:id/ohlcv — get candlestick data for a market */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const interval = (url.searchParams.get('interval') as CandleInterval) || '1h';
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 150;

    const candles = ohlcvEngine.getCandles(id, interval, limit);

    return jsonResponse({
      marketId: id,
      interval,
      candles,
      count: candles.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch market candles', 500));
  }
}
