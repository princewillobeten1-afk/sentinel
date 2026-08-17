import { QuoteResponse } from './quote';

export type RiskDecision = 'ALLOW' | 'WARN' | 'BLOCK';

export interface RiskCheckResult {
  decision: RiskDecision;
  reasoning: string[];
  factors: Record<string, any>;
}

export interface RiskCheckRequest {
  walletAddress: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  side: 'BUY' | 'SELL';
  /**
   * Only `priceImpact` is actually read by `evaluate()` below — narrowed
   * from the full `QuoteResponse` (still satisfied by one, since a complete
   * object structurally satisfies a `Pick` of itself) so callers with a
   * differently-shaped quote (e.g. `lib/execution/types.ts#Quote`,
   * `lib/quote/router.ts`'s Solana quote) don't need to fabricate the rest
   * of `QuoteResponse`'s fields just to pass a risk check.
   */
  quote: Pick<QuoteResponse, 'priceImpact'>;
  userConfig?: {
    maxTradeSizeUsd?: number;
    maxSlippage?: number;
    maxPriceImpact?: number;
  };
}

export class PreTradeRiskEngine {
  
  async evaluate(request: RiskCheckRequest): Promise<RiskCheckResult> {
    const reasons: string[] = [];
    const factors: Record<string, any> = {};
    let decision: RiskDecision = 'ALLOW';

    // 1. Balance Check (Mocked for now)
    // Normally we'd query the wallet balance here
    const hasEnoughBalance = true; // mock
    if (!hasEnoughBalance) {
      return {
        decision: 'BLOCK',
        reasoning: ['Insufficient balance for trade.'],
        factors: { error: 'INSUFFICIENT_BALANCE' }
      };
    }

    // 2. Price Impact Check
    const maxImpact = request.userConfig?.maxPriceImpact || 5.0; // default 5%
    factors.priceImpact = request.quote.priceImpact;
    if (request.quote.priceImpact > maxImpact) {
      decision = 'BLOCK';
      reasons.push(`Price impact (${request.quote.priceImpact}%) exceeds maximum allowed (${maxImpact}%).`);
    } else if (request.quote.priceImpact > 2.0) {
      decision = 'WARN';
      reasons.push(`High price impact (${request.quote.priceImpact}%).`);
    }

    // 3. Trade Size Check
    const maxTradeSize = request.userConfig?.maxTradeSizeUsd || 10000;
    // Mock USD value calculation
    const tradeValueUsd = parseFloat(request.amount) * (request.side === 'BUY' ? 1.0 : 2.0);
    factors.tradeValueUsd = tradeValueUsd;
    
    if (tradeValueUsd > maxTradeSize) {
      decision = 'BLOCK';
      reasons.push(`Trade size ($${tradeValueUsd}) exceeds maximum allowed ($${maxTradeSize}).`);
    }

    // 4. Token Risk Check (Mocking integration with Sprint 10 intelligence)
    // If tokenOut is a newly launched token with low liquidity
    const mockTokenRiskScore = request.tokenOut === 'NEW_TOKEN' ? 85 : 20; 
    factors.tokenRiskScore = mockTokenRiskScore;

    if (mockTokenRiskScore > 80 && request.side === 'BUY') {
      if (decision !== 'BLOCK') decision = 'WARN';
      reasons.push(`HIGH TOKEN RISK: Extreme ownership concentration or low liquidity detected.`);
    }

    if (decision === 'ALLOW') {
      reasons.push('All pre-trade risk checks passed.');
    }

    return {
      decision,
      reasoning: reasons,
      factors
    };
  }
}
