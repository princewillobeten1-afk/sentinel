import { PriceUpdate, PriceSource, globalPriceStream } from './price-stream';

export type TriggerOperator = '>' | '>=' | '<' | '<=' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';

export interface TriggerCondition {
  source: PriceSource;
  operator: TriggerOperator;
  targetPrice: number;
  token: string;
}

export interface ConditionalOrder {
  id: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  side: 'BUY' | 'SELL';
  quantityType: 'ABSOLUTE' | 'PERCENT_POSITION' | 'PERCENT_BALANCE';
  quantityValue: number;
  orderType: 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  status: 'OPEN' | 'MONITORING' | 'TRIGGER_DETECTED' | 'TRIGGER_VALIDATING' | 'TRIGGERED' | 'EXECUTION_PENDING' | 'EXECUTING' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED' | 'TRIGGER_FAILED';
  condition: TriggerCondition;
}

/**
 * TriggerEngine monitors a pool of ConditionalOrders against the PriceStream.
 */
export class TriggerEngine {
  private activeOrders: Map<string, ConditionalOrder> = new Map();
  // Idempotency lock to prevent multiple workers from triggering the same order
  private triggerLocks: Set<string> = new Set();
  
  constructor() {
    // Subscribe to the global price stream
    globalPriceStream.subscribe(this.onPriceUpdate.bind(this));
  }

  public registerOrder(order: ConditionalOrder) {
    if (order.status === 'OPEN' || order.status === 'MONITORING') {
      order.status = 'MONITORING';
      this.activeOrders.set(order.id, order);
    }
  }

  public unregisterOrder(orderId: string) {
    this.activeOrders.delete(orderId);
  }

  private onPriceUpdate(update: PriceUpdate) {
    for (const order of this.activeOrders.values()) {
      if (order.condition.token === update.token && order.condition.source === update.source) {
        if (this.evaluateCondition(order.condition, update.price)) {
          this.handleTrigger(order, update);
        }
      }
    }
  }

  private evaluateCondition(condition: TriggerCondition, currentPrice: number): boolean {
    switch (condition.operator) {
      case '>': return currentPrice > condition.targetPrice;
      case '>=': return currentPrice >= condition.targetPrice;
      case '<': return currentPrice < condition.targetPrice;
      case '<=': return currentPrice <= condition.targetPrice;
      // Crosses requires tracking previous price state, simplifying for MVP to standard inequalities
      case 'CROSSES_ABOVE': return currentPrice > condition.targetPrice; 
      case 'CROSSES_BELOW': return currentPrice < condition.targetPrice;
      default: return false;
    }
  }

  private async handleTrigger(order: ConditionalOrder, update: PriceUpdate) {
    if (this.triggerLocks.has(order.id)) return; // Prevent duplicate triggers

    this.triggerLocks.add(order.id);
    order.status = 'TRIGGER_DETECTED';

    console.log(`[TriggerEngine] Order ${order.id} triggered. Expected: ${order.condition.operator} ${order.condition.targetPrice}, Actual: ${update.price} (${update.source})`);

    // In a real system, this would push an event to a queue for the OrderService to pick up.
    // OrderService will transition from TRIGGER_DETECTED -> TRIGGER_VALIDATING -> TRIGGERED -> EXECUTION_PENDING.
    
    // For MVP demonstration, we mock the transition out
    setTimeout(() => {
      order.status = 'EXECUTION_PENDING';
      this.unregisterOrder(order.id); // It's no longer monitoring
      this.triggerLocks.delete(order.id); // Free memory
    }, 100);
  }
}

export const globalTriggerEngine = new TriggerEngine();
