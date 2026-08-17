import type { TradingProvider } from './provider';
import type { TradeHistoryRecord, TradeSimulationResult } from './types';
import type { Quote } from '@/lib/quote/types';
import { Decimal } from '@/lib/math/decimal';

const history: TradeHistoryRecord[] = [
  {
    id: 'history_001',
    symbol: '$SENT',
    side: 'buy',
    amountSol: 2.5,
    receivedTokens: 58823,
    priceUsd: 0.0425,
    status: 'confirmed',
    executedAt: new Date(Date.now() - 120000).toISOString(),
    txHash: 'Txq1a2b3c4d5e6f7g8h9',
  },
  {
    id: 'history_002',
    symbol: '$SENT',
    side: 'sell',
    amountSol: 0.8,
    receivedTokens: 18823,
    priceUsd: 0.0424,
    status: 'confirmed',
    executedAt: new Date(Date.now() - 360000).toISOString(),
    txHash: 'Txh9g8f7e6d5c4b3a2',
  },
];

function createPayload(quote: Quote, walletPublicKey: string, network: string): Uint8Array {
  const transaction = {
    type: 'sentinel-swap',
    wallet: walletPublicKey,
    network,
    quoteId: quote.id,
    side: quote.inputToken.toUpperCase() === 'SOL' ? 'buy' : 'sell',
    inputToken: quote.inputToken,
    outputToken: quote.outputToken,
    inputAmount: quote.inputAmount,
    minimumReceived: quote.minimumReceived,
    provider: quote.provider,
    route: quote.route,
    issuedAt: new Date().toISOString(),
  };
  return new TextEncoder().encode(JSON.stringify(transaction));
}

function createTxHash(): string {
  return `0x${Array.from({ length: 18 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
}

function isBase58Like(address: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export class MockTradingProvider implements TradingProvider {
  async simulateTrade(payload: {
    quote: Quote;
    walletPublicKey: string;
    availableSol: number;
    network: string;
  }): Promise<TradeSimulationResult> {
    const { quote, walletPublicKey, availableSol, network } = payload;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!quote || !quote.id) {
      errors.push('Invalid quote payload. Please refresh market data before signing.');
    }

    const expiresAt = new Date(quote.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      errors.push('Quote has expired. Fetch a new quote before signing.');
    }

    const inputAmountDecimal = new Decimal(quote.inputAmount);
    if (inputAmountDecimal.raw === 0n) {
      errors.push('Quote input amount is invalid.');
    }

    if (quote.inputToken.toUpperCase() === 'SOL') {
      const availableSolDecimal = new Decimal(availableSol.toString());
      if (inputAmountDecimal.raw > availableSolDecimal.raw) {
        errors.push('Insufficient SOL balance to execute this order.');
      }
    }

    if (!quote.route || quote.route.length === 0) {
      errors.push('Route failure detected: no executable path for this swap.');
    }

    if (!isBase58Like(walletPublicKey)) {
      warnings.push('Wallet address appears non-standard. Verify the selected wallet before signing.');
    }

    if (quote.priceImpact > 10) {
      errors.push('Slippage and price impact exceed the safety threshold for this order.');
    } else if (quote.priceImpact > 4) {
      warnings.push('High price impact detected; execution may be more expensive than expected.');
    }

    if (walletPublicKey.toLowerCase().includes('bad') || walletPublicKey.endsWith('0000')) {
      errors.push('Wallet account state invalid for trading (simulated frozen or rent-exempt mismatch).');
    }

    if (quote.provider.toLowerCase().includes('jupiter') && Date.now() % 29 === 0) {
      errors.push('Program execution failure detected during route simulation.');
    }

    const payloadBytes = createPayload(quote, walletPublicKey, network);
    if (payloadBytes.length === 0) {
      errors.push('Failed to construct transaction payload.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      transactionPayload: payloadBytes,
      simulatedTxHash: createTxHash(),
      idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
  }

  private dedupeMap = new Map<string, TradeHistoryRecord>();

  async submitTrade(payload: {
    quote: Quote;
    walletPublicKey: string;
    signature: string;
    network: string;
    idempotencyKey: string;
  }): Promise<TradeHistoryRecord> {
    if (this.dedupeMap.has(payload.idempotencyKey)) {
      return Promise.resolve(this.dedupeMap.get(payload.idempotencyKey)!);
    }

    const success = payload.signature.length > 0 && !payload.signature.includes('dead');
    const status = success ? 'confirmed' : 'failed';
    const amountSol = new Decimal(payload.quote.inputAmount).toNumber();
    const receivedTokens = Math.max(0, Math.round(new Decimal(payload.quote.minimumReceived).toNumber()));
    const priceUsd = new Decimal(payload.quote.estimatedPriceUsd).toNumber();
    const record: TradeHistoryRecord = {
      id: `history_${Date.now()}`,
      symbol: payload.quote.outputToken,
      side: payload.quote.inputToken.toUpperCase() === 'SOL' ? 'buy' : 'sell',
      amountSol,
      receivedTokens,
      priceUsd,
      status,
      executedAt: new Date().toISOString(),
      txHash: createTxHash(),
    };

    this.dedupeMap.set(payload.idempotencyKey, record);
    history.unshift(record);
    return Promise.resolve(record);
  }

  async getTradeHistory(userId: string): Promise<TradeHistoryRecord[]> {
    return Promise.resolve(history.slice(0, 10));
  }
}
