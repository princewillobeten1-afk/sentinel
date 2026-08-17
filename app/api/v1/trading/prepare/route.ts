import { z } from 'zod';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { parseJsonBody, validateSchema } from '@/lib/server/validation';
import { quoteRouter } from '@/lib/quote/router';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { PreTradeRiskEngine } from '@/lib/order/risk';
import { killSwitch } from '@/lib/server/kill-switch';
import { recordPriceImpactSample } from '@/lib/server/circuit-breaker';
import { recordAuditEvent } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';

const riskEngine = new PreTradeRiskEngine();

const prepareSchema = z.object({
  quoteId: z.string().min(1, 'Quote ID is required'),
  inputToken: z.string().min(1),
  outputToken: z.string().min(1),
  amount: z.string().min(1),
  slippage: z.number().min(0.01).max(15.0),
  walletAddress: z.string().min(20, 'Valid wallet address is required'),
});

/**
 * Requires `TRADE` — never grantable by default (spec §8, §95) — plus
 * `allowSessionAuth: true` so the web app's own trading panel keeps working
 * on session auth exactly as before. `idempotent: true` so a client retrying
 * after a timeout doesn't prepare two transactions for the same intent
 * (spec §67-68). Underlying execution is still simulated
 * (`lib/quote/router.ts`) — this only makes the gateway around it real.
 *
 * Sprint 30 — Tier 4 adds the same checks as `execution/submit`: kill
 * switch, circuit breaker, slippage enforcement, and the pre-trade risk
 * engine, all before a transaction is prepared.
 */
export const POST = withApiGateway(
  async (ctx, request) => {
  try {
    const user = ctx.user;
    const payload = await parseJsonBody(request);
    const data = validateSchema(prepareSchema, payload);

    if (killSwitch.isPaused('TRADING')) {
      throw new ApiError('Trading is currently paused platform-wide.', 503, 'TRADING_PAUSED');
    }

    // Re-verify parameters on backend
    const quote = await quoteRouter.getQuote({
      inputToken: data.inputToken,
      outputToken: data.outputToken,
      amount: data.amount,
      slippage: data.slippage,
      walletAddress: data.walletAddress,
    });

    const pairKey = `${data.inputToken}/${data.outputToken}`;
    const breaker = recordPriceImpactSample(pairKey, quote.priceImpact);
    if (breaker.tripped) {
      killSwitch.pause('TRADING', {
        reason: `Circuit breaker: ${breaker.recentExtremeCount} extreme-impact quotes for ${pairKey} within 60s.`,
        triggeredBy: 'system',
        source: 'CIRCUIT_BREAKER',
      });
      recordAuditEvent({
        userId: user.userId,
        action: 'CIRCUIT_BREAKER_TRIGGERED',
        entityType: 'kill_switch',
        entityId: 'TRADING',
        changes: { pairKey, recentExtremeCount: breaker.recentExtremeCount },
      });
      throw new ApiError('Trading paused: repeated extreme price impact detected for this pair.', 503, 'CIRCUIT_BREAKER_TRIPPED');
    }

    if (quote.priceImpact > data.slippage) {
      throw new ApiError(
        `Quote's price impact (${quote.priceImpact}%) exceeds your slippage limit (${data.slippage}%). Request a new quote.`,
        400,
        'SLIPPAGE_LIMIT_EXCEEDED',
      );
    }

    // quoteRouter is Solana-only today; side isn't carried explicitly in QuoteRequest, so
    // it's inferred the same way SolanaJupiterQuoteProvider infers direction internally —
    // SOL as input means acquiring the other token (BUY), SOL as output means SELL.
    const side = data.inputToken.toUpperCase() === 'SOL' ? 'BUY' : 'SELL';

    const riskResult = await riskEngine.evaluate({
      walletAddress: data.walletAddress,
      chain: 'solana',
      tokenIn: data.inputToken,
      tokenOut: data.outputToken,
      amount: data.amount,
      side,
      quote,
    });

    if (riskResult.decision === 'BLOCK') {
      recordAuditEvent({
        userId: user.userId,
        action: 'TRADE_BLOCKED_BY_RISK_ENGINE',
        entityType: 'user',
        entityId: user.userId,
        changes: { reasoning: riskResult.reasoning, factors: riskResult.factors },
      });
      throw new ApiError('Trade blocked by pre-trade risk checks.', 403, 'TRADE_BLOCKED_BY_RISK', {
        reasoning: riskResult.reasoning,
        factors: riskResult.factors,
      });
    }

    return jsonResponse({
      preparedTransaction: {
        id: `prep_${Date.now()}`,
        user: user.userId,
        wallet: data.walletAddress,
        quote,
        unsignedTxBase64: 'AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
      riskWarnings: riskResult.decision === 'WARN' ? riskResult.reasoning : [],
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to prepare transaction', 500));
  }
  },
  { scopes: ['TRADE'], allowSessionAuth: true, idempotent: true },
);
