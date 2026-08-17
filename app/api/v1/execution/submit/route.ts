export const dynamic = 'force-dynamic';
import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { withApiGateway } from '@/lib/server/api-gateway';
import { ExecutionEngine } from '@/lib/execution/engine';
import { Quote, ExecutionRequest } from '@/lib/execution/types';
import { PreTradeRiskEngine } from '@/lib/order/risk';
import { killSwitch } from '@/lib/server/kill-switch';
import { recordPriceImpactSample } from '@/lib/server/circuit-breaker';
import { recordAuditEvent } from '@/lib/server/audit';

const engine = new ExecutionEngine();
const riskEngine = new PreTradeRiskEngine();

/**
 * Previously fully public with no auth/scope check at all — the highest-risk
 * unauthenticated write found in the Sprint 28 route survey. Now gated behind
 * `TRADE` (a dangerous scope, never auto-granted — see `lib/server/scopes.ts`)
 * and idempotent so a retried submit can't double-execute.
 *
 * Sprint 30 — Tier 4 adds four checks, in order, before the (still simulated)
 * execution engine ever runs: kill switch, circuit breaker, slippage
 * enforcement, and the pre-trade risk engine (previously built but never
 * actually wired into this route — it only ever ran in the separate
 * conditional-order pipeline).
 */
export const POST = withApiGateway(
  async (ctx, request) => {
    try {
      const body = await request.json();
      const quote: Quote = body.quote;
      const execReq: ExecutionRequest = body.request;

      if (!quote || !execReq) {
        throw new ApiError('Quote and Request required', 400, 'MISSING_FIELDS');
      }

      if (killSwitch.isPaused('TRADING')) {
        throw new ApiError('Trading is currently paused platform-wide.', 503, 'TRADING_PAUSED');
      }

      const pairKey = `${execReq.tokenIn}/${execReq.tokenOut}`;
      const breaker = recordPriceImpactSample(pairKey, quote.priceImpact);
      if (breaker.tripped) {
        killSwitch.pause('TRADING', {
          reason: `Circuit breaker: ${breaker.recentExtremeCount} extreme-impact quotes for ${pairKey} within 60s.`,
          triggeredBy: 'system',
          source: 'CIRCUIT_BREAKER',
        });
        recordAuditEvent({
          userId: ctx.user.userId,
          action: 'CIRCUIT_BREAKER_TRIGGERED',
          entityType: 'kill_switch',
          entityId: 'TRADING',
          changes: { pairKey, recentExtremeCount: breaker.recentExtremeCount },
        });
        throw new ApiError('Trading paused: repeated extreme price impact detected for this pair.', 503, 'CIRCUIT_BREAKER_TRIPPED');
      }

      if (quote.priceImpact / 100 > execReq.slippageLimit) {
        throw new ApiError(
          `Quote's price impact (${quote.priceImpact}%) exceeds your slippage limit (${(execReq.slippageLimit * 100).toFixed(2)}%). Request a new quote.`,
          400,
          'SLIPPAGE_LIMIT_EXCEEDED',
        );
      }

      const riskResult = await riskEngine.evaluate({
        walletAddress: execReq.wallet,
        chain: execReq.chain,
        tokenIn: execReq.tokenIn,
        tokenOut: execReq.tokenOut,
        amount: execReq.amount,
        side: execReq.side === 'SWAP' ? 'SELL' : execReq.side,
        quote,
      });

      if (riskResult.decision === 'BLOCK') {
        recordAuditEvent({
          userId: ctx.user.userId,
          action: 'TRADE_BLOCKED_BY_RISK_ENGINE',
          entityType: 'user',
          entityId: ctx.user.userId,
          changes: { reasoning: riskResult.reasoning, factors: riskResult.factors },
        });
        throw new ApiError('Trade blocked by pre-trade risk checks.', 403, 'TRADE_BLOCKED_BY_RISK', {
          reasoning: riskResult.reasoning,
          factors: riskResult.factors,
        });
      }

      const result = await engine.execute(quote, execReq);
      return jsonResponse({
        ...result,
        riskWarnings: riskResult.decision === 'WARN' ? riskResult.reasoning : [],
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error : new ApiError('Failed to execute trade', 500));
    }
  },
  { scopes: ['TRADE'], allowSessionAuth: true, idempotent: true },
);
