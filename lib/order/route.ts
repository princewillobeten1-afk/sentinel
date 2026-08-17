import { QuoteEngine, QuoteRequest, QuoteResponse } from './quote';

export interface RouteScore {
  score: number; // 0-100
  breakdown: {
    priceScore: number;
    feeScore: number;
    gasScore: number;
    reliabilityScore: number;
  };
}

export interface RouteOption extends QuoteResponse {
  engineId: string;
  score: RouteScore;
}

export class RouteEngine {
  private engines: Map<string, QuoteEngine>;

  constructor() {
    this.engines = new Map();
  }

  registerEngine(id: string, engine: QuoteEngine) {
    this.engines.set(id, engine);
  }

  async getBestRoute(request: QuoteRequest): Promise<RouteOption | null> {
    const promises: Promise<RouteOption | null>[] = [];

    for (const [id, engine] of this.engines.entries()) {
      promises.push(this.getQuoteFromEngine(id, engine, request));
    }

    const results = await Promise.all(promises);
    const validRoutes = results.filter((r): r is RouteOption => r !== null);

    if (validRoutes.length === 0) {
      return null;
    }

    // Sort by descending score
    validRoutes.sort((a, b) => b.score.score - a.score.score);
    return validRoutes[0];
  }

  private async getQuoteFromEngine(engineId: string, engine: QuoteEngine, request: QuoteRequest): Promise<RouteOption | null> {
    try {
      const quote = await engine.getQuote(request);
      const score = this.scoreRoute(quote);
      
      return {
        ...quote,
        engineId,
        score
      };
    } catch (err) {
      console.warn(`Failed to get quote from engine ${engineId}:`, err);
      return null;
    }
  }

  private scoreRoute(quote: QuoteResponse): RouteScore {
    // Highly simplified mock scoring logic
    const priceScore = 80; // Baseline
    const feeScore = 90;
    const gasScore = 95;
    const reliabilityScore = 99; // Mock engine is very reliable
    
    // Weightings
    const score = (priceScore * 0.5) + (feeScore * 0.2) + (gasScore * 0.1) + (reliabilityScore * 0.2);

    return {
      score,
      breakdown: {
        priceScore,
        feeScore,
        gasScore,
        reliabilityScore
      }
    };
  }
}
