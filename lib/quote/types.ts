/**
 * Master Quote Types & Contracts (Sprint 46 §38-41).
 */

export type PriceImpactRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface QuoteRouteStep {
  poolName: string;
  dex: string;
  inputSymbol: string;
  outputSymbol: string;
  feePercent: number;
  estimatedDepthUsd: string;
}

export interface QuoteFeeDecomposition {
  networkFeeUsd: number;
  networkFeeNative: string;
  platformFeeUsd: number;
  dexFeeUsd: number;
  totalFeeUsd: number;
}

export interface QuoteRequest {
  chainId?: string;
  inputToken: string; // e.g. "SOL" or Mint address
  outputToken: string; // e.g. "SENTINEL" or Mint address
  amount: string; // Input amount as fixed-point string
  slippage: number; // e.g. 0.5 (for 0.5%)
  walletAddress?: string; // Optional connected wallet address
  marketId?: string; // Optional preferred market
}

export interface Quote {
  id: string;
  chainId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string; // Human-readable fixed-point decimal string
  inputAmountRaw?: string; // Raw base unit integer string
  outputAmount: string; // Human-readable fixed-point decimal string
  outputAmountRaw?: string; // Raw base unit integer string
  minimumReceived: string; // Human-readable fixed-point decimal string
  minimumReceivedRaw?: string; // Raw base unit integer string
  priceImpact: number; // Percentage e.g. 0.12%
  priceImpactMeasured?: boolean; // False when the provider supplied no impact measurement.
  priceImpactRating: PriceImpactRating;
  estimatedPriceUsd: string; // Fixed-point decimal price
  route: QuoteRouteStep[];
  fees: QuoteFeeDecomposition;
  networkFeeSol?: string;
  providerFeeUsd?: string;
  expiresAt: string; // ISO timestamp
  provider: string; // e.g. "Jupiter Router (Solana)"
  isValid: boolean;
  inputMint?: string;
  outputMint?: string;
  /** Full provider quote retained for a later serialized swap preparation. */
  providerQuote?: unknown;
}

export interface QuoteProvider {
  id: string;
  name: string;
  getQuote(request: QuoteRequest): Promise<Quote>;
}
