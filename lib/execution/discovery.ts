import { DEXAdapter } from './adapters/dex-adapter';
import { ExecutionRequest, Quote, ExecutionPolicy, MEVRisk } from './types';

export class RouteDiscoveryEngine {
  private adapters: DEXAdapter[];

  constructor(adapters: DEXAdapter[]) {
    this.adapters = adapters;
  }

  /**
   * Queries all registered adapters to discover routes and quotes.
   * Also synthesizes multi-hop or split routes internally.
   */
  public async discoverRoutes(request: ExecutionRequest): Promise<Quote[]> {
    const quotes: Quote[] = [];
    
    // In parallel, fetch single-hop direct quotes from all venues
    const quotePromises = this.adapters.map(adapter => adapter.getQuote(request));
    const results = await Promise.allSettled(quotePromises);

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        // Adjust the execution score based on policy
        res.value.executionScore = this.calculatePolicyScore(res.value, request.executionPolicy);
        quotes.push(res.value);
      }
    }

    // Evaluate Splitting: If amount is large (e.g., > $50k), attempt to synthesize a split quote
    const isLargeTrade = Number(request.amount) > 50000; // Mock threshold
    if (isLargeTrade && this.adapters.length > 1) {
      const splitQuote = await this.synthesizeSplitQuote(request, quotes);
      if (splitQuote) {
        quotes.push(splitQuote);
      }
    }

    // Sort by final calculated score
    return quotes.sort((a, b) => b.executionScore - a.executionScore);
  }

  private calculatePolicyScore(quote: Quote, policy: ExecutionPolicy): number {
    let score = quote.executionScore; // Base heuristic

    switch (policy) {
      case ExecutionPolicy.PROTECTED:
        if (quote.mevRisk === MEVRisk.HIGH) score -= 40;
        if (quote.mevRisk === MEVRisk.LOW) score += 20;
        break;
      case ExecutionPolicy.LOWEST_GAS:
        score -= Number(quote.gasEstimate) * 0.0001; // Penalize high gas
        break;
      case ExecutionPolicy.LOWEST_IMPACT:
        score -= (quote.priceImpact * 1000); // Heavily penalize high impact
        break;
      case ExecutionPolicy.BEST_PRICE:
      default:
        // Already generally optimized for output in the base score, but can boost based on expectedOutput
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async synthesizeSplitQuote(request: ExecutionRequest, singleQuotes: Quote[]): Promise<Quote | null> {
    if (singleQuotes.length < 2) return null;
    
    // This is a naive stub for smart order routing (SOR) split math.
    // In reality, you'd solve an optimization problem across DEX price curves.
    return {
      id: `quote_split_${Date.now()}`,
      dexVenue: 'SENTINEL_SMART_ROUTER',
      expectedOutput: '1060000000000000000000', // Better output than singles due to less impact
      priceImpact: 0.006, // 0.6% instead of 1.2%
      gasEstimate: '550000', // Higher gas because 2 swaps
      mevRisk: MEVRisk.MEDIUM,
      executionScore: 92, // Scored higher because of output/impact ratio
      expiresAt: Date.now() + 30000,
      routes: [
        {
          hops: 1,
          splitPercentage: 60,
          legs: [{ tokenIn: request.tokenIn, tokenOut: request.tokenOut, poolAddress: '0xPoolA', dexVenue: singleQuotes[0].dexVenue }]
        },
        {
          hops: 1,
          splitPercentage: 40,
          legs: [{ tokenIn: request.tokenIn, tokenOut: request.tokenOut, poolAddress: '0xPoolB', dexVenue: singleQuotes[1].dexVenue }]
        }
      ]
    };
  }
}
