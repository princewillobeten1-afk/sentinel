import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { ApiError } from '@/lib/server/errors';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { getSwapQuote, SOL_MINT } from '@/lib/trading/jupiter-quote';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/trading/instant
 *
 * Returns a **real, priced quote** for a swap, and the fact that it still needs
 * the user's signature. It does not execute anything.
 *
 * ## What this replaced
 *
 * The previous implementation was fifty lines with no chain access at all. It
 * answered every request with:
 *
 *     status:      'confirmed'
 *     txHash:      '5x' + Math.random().toString(36)
 *     explorerUrl: https://solscan.io/tx/<that fabricated hash>
 *     route:       'Jito MEV Protected Bundle -> Raydium CPMM'
 *     solPriceUsd  = 150.0     // hardcoded
 *     tokenPriceUsd = 0.0425   // hardcoded, identical for every token
 *
 * A user clicking Quick Trade was shown a confirmation, a transaction hash and
 * an explorer link for a trade that never happened, priced off two constants.
 * That is the most serious class of defect this product can ship, so the route
 * now reports what is true and nothing more.
 *
 * ## Why it cannot execute
 *
 * Sentinel is self-custodial: no private key is ever held server-side, under
 * any code path. A swap therefore has to be signed in the user's wallet. The
 * honest server-side contribution is a real quote plus an explicit
 * `requiresSignature`, which the client turns into a wallet prompt.
 */

const instantTradeSchema = z.object({
  side: z.enum(['buy', 'sell']),
  tokenMint: z.string().min(32, 'A token mint is required'),
  tokenSymbol: z.string().optional(),
  amountSol: z.number().positive('Amount must be greater than zero'),
  slippagePct: z.number().min(0.01).max(15).default(1),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJsonBody(request);
    const data = validateSchema(instantTradeSchema, payload);

    checkRateLimit(`instant_${data.tokenMint}`, 30, 60_000);

    // Buying spends SOL for the token; selling is the reverse. The old code
    // never distinguished them, which is how a "buy" could quote SOL for SOL.
    const inputMint = data.side === 'buy' ? SOL_MINT : data.tokenMint;
    const outputMint = data.side === 'buy' ? data.tokenMint : SOL_MINT;

    const quote = await getSwapQuote({
      inputMint,
      outputMint,
      amount: data.amountSol,
      slippageBps: Math.round(data.slippagePct * 100),
    });

    return jsonResponse({
      // Deliberately not 'confirmed'. Nothing has been submitted.
      status: 'quoted',
      requiresSignature: true,
      side: data.side,
      tokenMint: data.tokenMint,
      tokenSymbol: data.tokenSymbol ?? null,
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      minimumReceived: quote.minimumReceived,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps,
      route: quote.route,
      rate: quote.rate,
      quotedAt: quote.fetchedAt,
      // No txHash and no explorerUrl: there is no transaction to point at.
      note: 'Quote only. The swap must be signed in your wallet before it exists on-chain.',
    });
  } catch (error) {
    // A failed quote is reported as a failure — never a synthetic price on the
    // screen where money is committed. The reason is surfaced rather than
    // genericised: "Input and output mints are the same" tells the user why
    // the trade cannot be priced; "Internal server error" does not.
    if (error instanceof ApiError) return errorResponse(error);
    const reason = error instanceof Error ? error.message : 'Failed to quote this swap';
    return errorResponse(new ApiError(reason, 422));
  }
}
