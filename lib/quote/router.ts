import { QuoteRequest, Quote, QuoteProvider, QuoteRouteStep } from './types';
import { Decimal } from '@/lib/math/decimal';

/**
 * Mock Jupiter / Solana DEX Route Provider for prototype execution.
 */
class SolanaJupiterQuoteProvider implements QuoteProvider {
  public id = 'jupiter-solana';
  public name = 'Jupiter Aggregator (Solana Mainnet)';

  private getTokenDecimals(token: string): number {
    return token.toUpperCase() === 'SOL' ? 9 : 9;
  }

  public async getQuote(request: QuoteRequest): Promise<Quote> {
    const inputDec = new Decimal(request.amount || '0');
    if (inputDec.raw === 0n) {
      throw new Error('Input amount must be greater than zero.');
    }

    const inputDecimals = this.getTokenDecimals(request.inputToken);
    const outputDecimals = this.getTokenDecimals(request.outputToken);

    // Default exchange rate assumption: 1 SOL = 41.3043 $SENTINEL (or inverse)
    const isBuySol = request.inputToken.toUpperCase() === 'SOL';
    const rate = isBuySol ? new Decimal('41.304347826086956521') : new Decimal('0.024210526315789473');

    const outputDec = inputDec.mul(rate);
    const slippageFrac = new Decimal(request.slippage / 100);
    const minReceivedDec = outputDec.mul(new Decimal(1).sub(slippageFrac));

    // Calculate price impact based on order size
    const inputNum = inputDec.toNumber();
    const priceImpact = Math.min(15.0, Math.max(0.01, inputNum * 0.04));

    const inputAmountRaw = Decimal.toBaseUnits(request.amount, inputDecimals).toString();
    const outputAmountRaw = Decimal.toBaseUnits(outputDec.toString(18), outputDecimals).toString();
    const minimumReceivedRaw = Decimal.toBaseUnits(minReceivedDec.toString(18), outputDecimals).toString();

    const routeSteps: QuoteRouteStep[] = isBuySol
      ? [
          { poolName: 'SOL/USDC Pool', dex: 'Orca Whirlpools', inputSymbol: 'SOL', outputSymbol: 'USDC', feePercent: 0.04, estimatedDepthUsd: '4250000.00' },
          { poolName: 'USDC/SENT Pool', dex: 'Raydium CLMM', inputSymbol: 'USDC', outputSymbol: 'SENT', feePercent: 0.25, estimatedDepthUsd: '1850000.00' },
        ]
      : [
          { poolName: 'SENT/USDC Pool', dex: 'Raydium CLMM', inputSymbol: 'SENT', outputSymbol: 'USDC', feePercent: 0.25, estimatedDepthUsd: '1850000.00' },
          { poolName: 'USDC/SOL Pool', dex: 'Orca Whirlpools', inputSymbol: 'USDC', outputSymbol: 'SOL', feePercent: 0.04, estimatedDepthUsd: '4250000.00' },
        ];

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      chainId: request.chainId || 'solana',
      inputToken: request.inputToken,
      outputToken: request.outputToken,
      inputAmount: inputDec.toString(18),
      inputAmountRaw,
      outputAmount: outputDec.toString(18),
      outputAmountRaw,
      minimumReceived: minReceivedDec.toString(18),
      minimumReceivedRaw,
      priceImpact: Number(priceImpact.toFixed(2)),
      priceImpactRating: 'LOW',
      estimatedPriceUsd: isBuySol ? '3.450000000000000000' : '142.500000000000000000',
      route: routeSteps,
      fees: {
        networkFeeUsd: 0.0015,
        networkFeeNative: '0.000005',
        platformFeeUsd: 0.0,
        dexFeeUsd: 0.05,
        totalFeeUsd: 0.0515,
      },
      networkFeeSol: '0.000005000000000000',
      providerFeeUsd: '0.050000000000000000',
      expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 seconds expiration
      provider: this.name,
      isValid: true,
    };
  }
}

/**
 * QuoteRouter — Abstraction managing DEX Quote Providers.
 * Compares routes and returns authoritative swap quotes using fixed-point Decimal math.
 */
export class QuoteRouter {
  private static instance: QuoteRouter;
  private providers: Map<string, QuoteProvider> = new Map();
  private defaultProviderId = 'jupiter-solana';

  private constructor() {
    const jupiter = new SolanaJupiterQuoteProvider();
    this.providers.set(jupiter.id, jupiter);
  }

  public static getInstance(): QuoteRouter {
    if (!QuoteRouter.instance) {
      QuoteRouter.instance = new QuoteRouter();
    }
    return QuoteRouter.instance;
  }

  public registerProvider(provider: QuoteProvider): void {
    this.providers.set(provider.id, provider);
  }

  public async getQuote(request: QuoteRequest, providerId?: string): Promise<Quote> {
    const pId = providerId || this.defaultProviderId;
    const provider = this.providers.get(pId);
    if (!provider) {
      throw new Error(`Quote provider '${pId}' not found.`);
    }

    return provider.getQuote(request);
  }
}

export const quoteRouter = QuoteRouter.getInstance();
