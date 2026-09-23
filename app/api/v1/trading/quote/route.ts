import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { ApiError } from '@/lib/server/errors';
import { getSwapQuote } from '@/lib/trading/jupiter-quote';
import type { Quote, PriceImpactRating } from '@/lib/quote/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/trading/quote
 *
 * A real swap quote, in the `Quote` shape the trading panel already renders.
 *
 * ## What this replaced
 *
 * This route delegated to `lib/quote/router.ts`, whose provider applies one
 * hardcoded rate to every pair it is asked about:
 *
 *     const rate = isBuySol ? new Decimal('41.304347826086956521') : ...
 *
 * That constant is a SOL-to-SENTINEL rate for a token that does not exist
 * on-chain, and it was applied regardless of which mints were requested — the
 * origin of the panel offering 0.5 SOL in exchange for "20.6522 SOL".
 *
 * Mints, not symbols. The old contract took `inputToken: 'SOL'` and a symbol,
 * which cannot identify a token: symbols collide constantly on Solana, and
 * routing the wrong mint is how a user buys a copycat.
 */

const quoteRequestSchema = z.object({
  /** Mint address. `inputSymbol`/`outputSymbol` are display labels only. */
  inputMint: z.string().min(32, 'inputMint must be a mint address'),
  outputMint: z.string().min(32, 'outputMint must be a mint address'),
  inputSymbol: z.string().optional(),
  outputSymbol: z.string().optional(),
  amount: z.string().min(1, 'Amount is required'),
  slippage: z.number().min(0.01).max(15),
});

function ratingFor(impact: number | null): PriceImpactRating {
  // Unknown is treated as the cautious end rather than the reassuring one: an
  // unmeasured impact is not a low impact.
  if (impact === null) return 'HIGH';
  if (impact < 1) return 'LOW';
  if (impact < 3) return 'MEDIUM';
  return 'HIGH';
}

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(quoteRequestSchema, payload);

    checkRateLimit(`quote_${data.inputMint}_${data.outputMint}`, 30, 60_000);

    const quote = await getSwapQuote({
      inputMint: data.inputMint,
      outputMint: data.outputMint,
      amount: data.amount,
      slippageBps: Math.round(data.slippage * 100),
    });

    const outputNum = Number(quote.outputAmount);
    const inputNum = Number(quote.inputAmount);

    const mapped: Quote = {
      id: `q_${Date.now()}_${quote.inputMint.slice(0, 4)}${quote.outputMint.slice(0, 4)}`,
      chainId: 'solana',
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      providerQuote: quote.providerQuote,
      inputAmountRaw: quote.providerQuote.inAmount,
      outputAmountRaw: quote.providerQuote.outAmount,
      minimumReceivedRaw: quote.providerQuote.otherAmountThreshold,
      inputToken: data.inputSymbol ?? data.inputMint,
      outputToken: data.outputSymbol ?? data.outputMint,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      minimumReceived: quote.minimumReceived,
      priceImpact: quote.priceImpactPct ?? 0,
      priceImpactMeasured: quote.priceImpactPct !== null,
      priceImpactRating: ratingFor(quote.priceImpactPct),
      // Unit price of the *input* in output terms, which is what the panel
      // labels "Est. Price".
      estimatedPriceUsd: inputNum > 0 ? String(outputNum / inputNum) : '0',
      // Jupiter names the venues it routes through but does not publish their
      // pool depth or per-hop fee. Those are left at zero rather than filled
      // with plausible numbers — the depth figure in particular would read as
      // liquidity analysis.
      route: quote.route.map((label) => ({
        poolName: label,
        dex: label,
        inputSymbol: data.inputSymbol ?? '',
        outputSymbol: data.outputSymbol ?? '',
        feePercent: 0,
        estimatedDepthUsd: '0',
      })),
      // Not decomposed by the quote API, and inventing a breakdown is part of
      // what made the previous quote untrustworthy.
      fees: {
        networkFeeUsd: 0,
        networkFeeNative: '0',
        platformFeeUsd: 0,
        dexFeeUsd: 0,
        totalFeeUsd: 0,
      },
      expiresAt: new Date(Date.now() + 20_000).toISOString(),
      provider: quote.route.length ? `Jupiter (${quote.route.join(' → ')})` : 'Jupiter',
      isValid: true,
    };

    return jsonResponse({ quote: mapped });
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    // The reason is surfaced. A quote screen that says "Internal server error"
    // tells the user nothing about whether the trade is possible.
    const reason = error instanceof Error ? error.message : 'Failed to generate quote';
    return errorResponse(new ApiError(reason, 422));
  }
}
