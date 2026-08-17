import { MockQuoteEngine, QuoteRequest, QuoteResponse } from './quote';
import { PreTradeRiskEngine, RiskCheckResult } from './risk';
import { RouteEngine } from './route';

export type OrderExecutionStatus = 
  | 'DRAFT'
  | 'VALIDATING'
  | 'QUOTING'
  | 'RISK_BLOCKED'
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'BROADCASTING'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PARTIALLY_FILLED'
  | 'FAILED'
  | 'REVERTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface OrderIntent {
  id: string;
  userId: string;
  walletId: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  amountIn: number;
  expectedOut?: number;
  minimumOut?: number;
  slippageBps: number;
  status: OrderExecutionStatus;
  transactionHash?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderQuoteRecord {
  id: string;
  orderId: string;
  route: string[];
  expectedOutput: number;
  priceImpactPct: number;
  networkFeeUsd: number;
  expiresAt: string;
  createdAt: string;
}

export interface OrderExecutionRecord {
  id: string;
  orderId: string;
  status: OrderExecutionStatus;
  actualOutput?: number;
  feesPaidUsd?: number;
  gasPaidUsd?: number;
  txHash?: string;
  errorReason?: string;
  executedAt: string;
}

// Global in-memory storage for active order intents & quotes (acting as DB state layer for API)
const orderStore = new Map<string, OrderIntent>();
const quoteStore = new Map<string, OrderQuoteRecord>();
const executionStore = new Map<string, OrderExecutionRecord[]>();
const idempotencyStore = new Map<string, string>(); // idempotencyKey -> orderId

export class OrderManager {
  private quoteEngine = new MockQuoteEngine();
  private riskEngine = new PreTradeRiskEngine();
  private routeEngine = new RouteEngine();

  createOrderIntent(params: {
    userId: string;
    walletId: string;
    chainId?: string;
    tokenIn: string;
    tokenOut: string;
    side: 'buy' | 'sell';
    type?: 'market' | 'limit' | 'stop' | 'stop_limit';
    amountIn: number;
    slippageBps?: number;
    idempotencyKey?: string;
  }): { order: OrderIntent; isDuplicate: boolean } {
    if (params.idempotencyKey && idempotencyStore.has(params.idempotencyKey)) {
      const existingId = idempotencyStore.get(params.idempotencyKey)!;
      const existing = orderStore.get(existingId);
      if (existing) {
        return { order: existing, isDuplicate: true };
      }
    }

    const orderId = `ord_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const order: OrderIntent = {
      id: orderId,
      userId: params.userId,
      walletId: params.walletId,
      chainId: params.chainId || 'solana',
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      side: params.side,
      type: params.type || 'market',
      amountIn: params.amountIn,
      slippageBps: params.slippageBps ?? 100,
      status: 'DRAFT',
      idempotencyKey: params.idempotencyKey,
      createdAt: now,
      updatedAt: now
    };

    orderStore.set(orderId, order);
    if (params.idempotencyKey) {
      idempotencyStore.set(params.idempotencyKey, orderId);
    }

    return { order, isDuplicate: false };
  }

  async generateQuote(orderId: string): Promise<{ order: OrderIntent; quote: OrderQuoteRecord }> {
    const order = orderStore.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.status = 'QUOTING';
    order.updatedAt = new Date().toISOString();

    const quoteReq: QuoteRequest = {
      chain: order.chainId,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amount: order.amountIn.toString(),
      side: order.side === 'buy' ? 'BUY' : 'SELL',
      slippageTolerance: order.slippageBps / 100
    };

    const quoteRes = await this.quoteEngine.getQuote(quoteReq);
    
    const quoteRecord: OrderQuoteRecord = {
      id: `quo_${Math.random().toString(36).substring(2, 10)}`,
      orderId: order.id,
      route: quoteRes.routeData?.path || [order.tokenIn, order.tokenOut],
      expectedOutput: parseFloat(quoteRes.expectedOutput),
      priceImpactPct: quoteRes.priceImpact,
      networkFeeUsd: quoteRes.gas.usdValue,
      expiresAt: new Date(quoteRes.expiresAt).toISOString(),
      createdAt: new Date().toISOString()
    };

    order.expectedOut = quoteRecord.expectedOutput;
    order.minimumOut = parseFloat(quoteRes.minimumOutput);
    quoteStore.set(orderId, quoteRecord);

    return { order, quote: quoteRecord };
  }

  async validateRisk(orderId: string): Promise<{ order: OrderIntent; riskResult: RiskCheckResult }> {
    const order = orderStore.get(orderId);
    const quote = quoteStore.get(orderId);
    if (!order || !quote) {
      throw new Error(`Order or quote not found for ${orderId}`);
    }

    order.status = 'VALIDATING';
    order.updatedAt = new Date().toISOString();

    const riskResult = await this.riskEngine.evaluate({
      walletAddress: order.walletId,
      chain: order.chainId,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amount: order.amountIn.toString(),
      side: order.side === 'buy' ? 'BUY' : 'SELL',
      quote: { priceImpact: quote.priceImpactPct },
    });

    if (riskResult.decision === 'BLOCK') {
      order.status = 'RISK_BLOCKED';
      order.updatedAt = new Date().toISOString();
    } else {
      order.status = 'AWAITING_SIGNATURE';
      order.updatedAt = new Date().toISOString();
    }

    return { order, riskResult };
  }

  async executeOrder(orderId: string, simulateFailure = false): Promise<{ order: OrderIntent; execution: OrderExecutionRecord }> {
    const order = orderStore.get(orderId);
    const quote = quoteStore.get(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === 'RISK_BLOCKED') {
      throw new Error('Cannot execute an order that was blocked by Risk Check');
    }

    // Check quote expiration
    if (quote && new Date(quote.expiresAt).getTime() < Date.now()) {
      order.status = 'EXPIRED';
      order.updatedAt = new Date().toISOString();
      throw new Error('Quote has expired. Please request a new quote.');
    }

    order.status = 'BROADCASTING';
    order.updatedAt = new Date().toISOString();

    const mockTxHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;

    if (simulateFailure) {
      order.status = 'FAILED';
      order.updatedAt = new Date().toISOString();

      const failedExecution: OrderExecutionRecord = {
        id: `exec_${Math.random().toString(36).substring(2, 10)}`,
        orderId,
        status: 'FAILED',
        errorReason: 'Simulation or RPC node transaction execution failed',
        executedAt: new Date().toISOString()
      };

      const history = executionStore.get(orderId) || [];
      history.push(failedExecution);
      executionStore.set(orderId, history);

      return { order, execution: failedExecution };
    }

    // Successful confirmation
    order.status = 'CONFIRMED';
    order.transactionHash = mockTxHash;
    order.updatedAt = new Date().toISOString();

    const actualOut = quote ? quote.expectedOutput * (1 - (Math.random() * 0.002)) : order.amountIn; // tiny slippage

    const successExecution: OrderExecutionRecord = {
      id: `exec_${Math.random().toString(36).substring(2, 10)}`,
      orderId,
      status: 'CONFIRMED',
      actualOutput: actualOut,
      feesPaidUsd: quote ? quote.networkFeeUsd : 0.01,
      gasPaidUsd: 0.005,
      txHash: mockTxHash,
      executedAt: new Date().toISOString()
    };

    const history = executionStore.get(orderId) || [];
    history.push(successExecution);
    executionStore.set(orderId, history);

    return { order, execution: successExecution };
  }

  getOrder(orderId: string): { order?: OrderIntent; quote?: OrderQuoteRecord; executions?: OrderExecutionRecord[] } {
    return {
      order: orderStore.get(orderId),
      quote: quoteStore.get(orderId),
      executions: executionStore.get(orderId)
    };
  }

  getUserOrders(userId: string): OrderIntent[] {
    return Array.from(orderStore.values()).filter(o => o.userId === userId);
  }
}

export const orderManager = new OrderManager();
