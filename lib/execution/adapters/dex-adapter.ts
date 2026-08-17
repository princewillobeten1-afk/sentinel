import { ExecutionRequest, Quote, SimulationResult } from '../types';

export interface DEXAdapter {
  getIdentifier(): string;
  
  getQuote(request: ExecutionRequest): Promise<Quote | null>;
  
  getLiquidity(tokenAddress: string): Promise<number>; // USD equivalent
  
  buildSwap(quote: Quote, slippage: number): Promise<string>; // Calldata
  
  simulateSwap(quote: Quote, calldata: string): Promise<SimulationResult>;
  
  healthCheck(): Promise<{ isHealthy: boolean; latencyMs: number }>;
}

/**
 * Mock EVM Router Adapter
 */
export class MockUniswapAdapter implements DEXAdapter {
  getIdentifier() { return 'UNISWAP_V3_MOCK'; }

  async getQuote(request: ExecutionRequest): Promise<Quote | null> {
    // Stub
    return {
      id: `quote_uni_${Date.now()}`,
      dexVenue: this.getIdentifier(),
      expectedOutput: '1050000000000000000000', // 1050 TOKEN
      priceImpact: 0.012, // 1.2%
      gasEstimate: '300000', // gas limit
      mevRisk: 'LOW' as any,
      executionScore: 90,
      expiresAt: Date.now() + 30000, // 30s
      routes: [
        {
          hops: 1,
          splitPercentage: 100,
          legs: [
            {
              tokenIn: request.tokenIn,
              tokenOut: request.tokenOut,
              poolAddress: '0xmockPool',
              dexVenue: this.getIdentifier()
            }
          ]
        }
      ]
    };
  }

  async getLiquidity(tokenAddress: string): Promise<number> {
    return 1500000; // $1.5M mock liquidity
  }

  async buildSwap(quote: Quote, slippage: number): Promise<string> {
    return '0xmockcalldata';
  }

  async simulateSwap(quote: Quote, calldata: string): Promise<SimulationResult> {
    return {
      willRevert: false,
      expectedTokenOutput: quote.expectedOutput,
      estimatedGasUsage: parseInt(quote.gasEstimate, 10) || 150000,
      warnings: []
    };
  }

  async healthCheck(): Promise<{ isHealthy: boolean; latencyMs: number }> {
    return { isHealthy: true, latencyMs: 120 };
  }
}
