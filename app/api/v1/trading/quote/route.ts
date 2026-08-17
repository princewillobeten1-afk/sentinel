import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { quoteRouter } from '@/lib/quote/router';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const quoteRequestSchema = z.object({
  inputToken: z.string().min(1, 'Input token is required'),
  outputToken: z.string().min(1, 'Output token is required'),
  amount: z.string().min(1, 'Amount is required'),
  slippage: z.number().min(0.01, 'Slippage must be at least 0.01%').max(15.0, 'Slippage cannot exceed 15.0%'),
  walletAddress: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(quoteRequestSchema, payload);

    checkRateLimit(`quote_${data.inputToken}_${data.outputToken}`, 30, 60000);

    const quote = await quoteRouter.getQuote({
      inputToken: data.inputToken,
      outputToken: data.outputToken,
      amount: data.amount,
      slippage: data.slippage,
      walletAddress: data.walletAddress,
    });

    return jsonResponse({ quote });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to generate trading quote', 500));
  }
}
