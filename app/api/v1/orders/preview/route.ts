import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { quoteService } from '@/lib/quote/quote-service';
import { executionService } from '@/lib/execution/execution-service';

export const dynamic = 'force-dynamic';

/** POST /api/v1/orders/preview — generate transaction preview from quote */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, walletAddress, userId = 'user_default' } = body;

    if (!quoteId || !walletAddress) {
      throw new ApiError('Missing quoteId or walletAddress', 400);
    }

    const quote = quoteService.getQuoteById(quoteId);
    if (!quote || !quote.isValid) {
      throw new ApiError('Quote has expired or is invalid. Please request a fresh quote.', 400);
    }

    const { intent, preparedTx } = await executionService.prepareTransaction({
      userId,
      walletAddress,
      quoteId,
    });

    return jsonResponse({
      preview: {
        intentId: intent.intentId,
        quoteId: quote.id,
        youPay: `${quote.inputAmount} ${quote.inputToken.slice(0, 4).toUpperCase()}`,
        youReceive: `${quote.outputAmount} ${quote.outputToken.slice(0, 4).toUpperCase()}`,
        minimumReceived: `${quote.minimumReceived} ${quote.outputToken.slice(0, 4).toUpperCase()}`,
        priceImpact: quote.priceImpact,
        priceImpactRating: quote.priceImpactRating,
        route: quote.route,
        fees: quote.fees,
        expiresAt: quote.expiresAt,
        simulationRequired: preparedTx.simulationRequired,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate transaction preview', 500));
  }
}
