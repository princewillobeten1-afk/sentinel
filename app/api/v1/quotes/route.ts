import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { quoteService } from '@/lib/quote/quote-service';

export const dynamic = 'force-dynamic';

/** GET /api/v1/quotes — generate authoritative swap quote with 15s expiration */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const inputToken = url.searchParams.get('inputToken') || 'SOL';
    const outputToken = url.searchParams.get('outputToken') || 'So11111111111111111111111111111111111111112';
    const amount = url.searchParams.get('amount') || '1.0';
    const slippage = url.searchParams.get('slippage') ? parseFloat(url.searchParams.get('slippage')!) : 0.5;
    const chainId = url.searchParams.get('chainId') || 'solana';

    const quote = await quoteService.getQuote({
      chainId,
      inputToken,
      outputToken,
      amount,
      slippage,
    });

    return jsonResponse(quote);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate quote', 400));
  }
}
