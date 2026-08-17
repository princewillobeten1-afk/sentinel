import { QuoteRequest } from './quote';
import { RouteEngine, RouteOption } from './route';
import { PreTradeRiskEngine, RiskCheckResult } from './risk';
import { OrderExecutionEngine } from './execution';
import { TransactionService } from '../transaction/service';
import { WalletProvider } from '../wallet/provider';
import { TransactionIntent, TransactionStatus, TransactionRecord } from '../transaction/simulator';

export type OrderStatus = 
  | 'CREATED' 
  | 'QUOTING' 
  | 'RISK_CHECK' 
  | 'SIMULATING' 
  | 'AWAITING_SIGNATURE' 
  | 'SIGNED' 
  | 'SUBMITTED' 
  | 'EXECUTING' 
  | 'PARTIALLY_FILLED' 
  | 'FILLED' 
  | 'CANCELLED' 
  | 'EXPIRED' 
  | 'REJECTED' 
  | 'FAILED';

export interface Order {
  id: string;
  walletAddress: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  side: 'BUY' | 'SELL';
  status: OrderStatus;
  route?: RouteOption;
  riskResult?: RiskCheckResult;
  error?: string;
  executionRecords: TransactionRecord[];
}

export class OrderService {
  private routeEngine: RouteEngine;
  private riskEngine: PreTradeRiskEngine;
  private executionEngine: OrderExecutionEngine;
  private transactionService: TransactionService;

  // Simple in-memory store for MVP. Will be moved to DB.
  private orders: Map<string, Order> = new Map();
  // Idempotency cache
  private processedRequests: Set<string> = new Set();

  constructor(
    routeEngine: RouteEngine, 
    riskEngine: PreTradeRiskEngine, 
    transactionService: TransactionService
  ) {
    this.routeEngine = routeEngine;
    this.riskEngine = riskEngine;
    this.transactionService = transactionService;
    this.executionEngine = new OrderExecutionEngine(transactionService);
  }

  async createAndExecuteMarketOrder(
    idempotencyKey: string,
    wallet: WalletProvider,
    request: QuoteRequest,
    onStatusChange: (status: OrderStatus, order: Order) => void,
    onTxStatusChange: (status: TransactionStatus, record: TransactionRecord) => void
  ): Promise<Order> {
    
    if (this.processedRequests.has(idempotencyKey)) {
      throw new Error('Duplicate request detected.');
    }
    this.processedRequests.add(idempotencyKey);

    const order: Order = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      walletAddress: wallet.getAddress() || '',
      chain: request.chain,
      tokenIn: request.tokenIn,
      tokenOut: request.tokenOut,
      amount: request.amount,
      side: request.side,
      status: 'CREATED',
      executionRecords: []
    };

    this.orders.set(order.id, order);
    
    const update = (status: OrderStatus, error?: string) => {
      order.status = status;
      if (error) order.error = error;
      onStatusChange(status, order);
    };

    try {
      update('QUOTING');
      const bestRoute = await this.routeEngine.getBestRoute(request);
      
      if (!bestRoute) {
        update('FAILED', 'No available routes for this swap.');
        return order;
      }
      order.route = bestRoute;

      update('RISK_CHECK');
      const riskResult = await this.riskEngine.evaluate({
        walletAddress: order.walletAddress,
        chain: request.chain,
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amount: request.amount,
        side: request.side,
        quote: bestRoute
      });
      
      order.riskResult = riskResult;

      if (riskResult.decision === 'BLOCK') {
        update('REJECTED', riskResult.reasoning.join(' '));
        return order;
      }

      // If 'WARN', we would ideally pause and await user confirmation.
      // For MVP execution flow, we will proceed but log the warning.

      update('SIMULATING');
      
      // Build Intent for TransactionService
      const intent: TransactionIntent = this.transactionService.createIntent(request.side, {
        amountIn: parseFloat(request.amount),
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        minAmountOut: parseFloat(bestRoute.minimumOutput),
        destination: order.walletAddress
      });

      // TransactionService handles SIMULATING -> SIGNED -> BROADCASTING -> CONFIRMED
      const executionResult = await this.executionEngine.execute(
        wallet,
        intent,
        bestRoute,
        (txStatus, record) => {
          // Map Tx status to Order status
          if (txStatus === 'SIMULATING') update('SIMULATING');
          if (txStatus === 'AWAITING_SIGNATURE') update('AWAITING_SIGNATURE');
          if (txStatus === 'SIGNED') update('SIGNED');
          if (txStatus === 'SUBMITTED' || txStatus === 'BROADCASTING') update('SUBMITTED');
          if (txStatus === 'CONFIRMING') update('EXECUTING');
          
          order.executionRecords.push(record);
          onTxStatusChange(txStatus, record);
        }
      );

      if (executionResult.status === 'FILLED') {
        update('FILLED');
      } else if (executionResult.status === 'REJECTED') {
        update('CANCELLED', executionResult.error);
      } else {
        update('FAILED', executionResult.error);
      }

      return order;

    } catch (err: any) {
      update('FAILED', err.message);
      return order;
    }
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  cancelOrder(id: string): boolean {
    const order = this.orders.get(id);
    if (!order) return false;

    // Can only cancel before signature
    const cancellableStates: OrderStatus[] = ['CREATED', 'QUOTING', 'RISK_CHECK', 'SIMULATING', 'AWAITING_SIGNATURE'];
    
    if (cancellableStates.includes(order.status)) {
      order.status = 'CANCELLED';
      order.error = 'Cancelled by user';
      return true;
    }
    
    return false;
  }
}
