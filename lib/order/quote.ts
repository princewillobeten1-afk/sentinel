export interface QuoteRequest {
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  side: 'BUY' | 'SELL';
  slippageTolerance?: number; // percentage, e.g. 0.5
}

export interface QuoteResponse {
  id: string; // Used to identify the quote in the route engine
  expectedOutput: string;
  minimumOutput: string;
  priceImpact: number;
  fees: {
    token: string;
    amount: string;
    usdValue: number;
  }[];
  gas: {
    token: string;
    estimatedAmount: string;
    usdValue: number;
  };
  executionPrice: number;
  expiresAt: number; // timestamp
  routeData?: any; // Engine-specific routing data to be passed to execution
}

export interface QuoteEngine {
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  validateQuote(quoteId: string): Promise<boolean>;
}

// Temporary Mock Implementation for MVP
export class MockQuoteEngine implements QuoteEngine {
  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const isBuy = request.side === 'BUY';
    // Mock prices: Assume token is worth $2.00, USDC is $1.00
    // If buying TOKEN with USDC (amount = USDC amount)
    // If selling TOKEN for USDC (amount = TOKEN amount)
    
    let expectedOutputNum: number;
    let executionPrice: number;

    if (isBuy) {
      // Buying Token with USDC
      const inputUsdc = parseFloat(request.amount);
      expectedOutputNum = inputUsdc / 2.0;
      executionPrice = 2.0;
    } else {
      // Selling Token for USDC
      const inputToken = parseFloat(request.amount);
      expectedOutputNum = inputToken * 2.0;
      executionPrice = 2.0;
    }

    // Apply mock slippage (0.5%) and price impact (0.1%)
    const priceImpact = 0.1;
    const slip = request.slippageTolerance || 0.5;
    
    const minOutputNum = expectedOutputNum * (1 - (slip / 100));

    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      expectedOutput: expectedOutputNum.toString(),
      minimumOutput: minOutputNum.toString(),
      priceImpact,
      fees: [
        {
          token: isBuy ? request.tokenIn : request.tokenOut, // assume fee in output or input
          amount: (parseFloat(request.amount) * 0.001).toString(), // 0.1% fee
          usdValue: (parseFloat(request.amount) * 0.001) * (isBuy ? 1 : 2)
        }
      ],
      gas: {
        token: 'SOL',
        estimatedAmount: '0.000005',
        usdValue: 0.001
      },
      executionPrice,
      expiresAt: Date.now() + 8000, // 8 seconds TTL
      routeData: {
        source: 'mock-dex-aggregator',
        path: [request.tokenIn, request.tokenOut]
      }
    };
  }

  async validateQuote(quoteId: string): Promise<boolean> {
    return true; // Mock validation
  }
}
