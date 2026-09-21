import { LimitOrder, LimitOrderConditions, LimitOrderVersion, LimitOrderStatus } from './types';
import { conditionEngine, MarketSnapshot } from './condition-engine';
import { limitOrderReservationEngine } from './reservation-engine';
import { orderManager } from '../order/manager';

const limitOrderStore = new Map<string, LimitOrder>(); // id -> order
const limitOrderVersionsStore = new Map<string, LimitOrderVersion[]>(); // limitOrderId -> versions

export class LimitOrderService {
  public createLimitOrder(params: {
    userId: string;
    walletId: string;
    chainId?: string;
    tokenIn: string;
    tokenOut: string;
    tokenMint: string;
    side: 'buy' | 'sell';
    targetPrice: number;
    amountIn: number;
    slippageBps?: number;
    conditions?: LimitOrderConditions;
    expiresAt?: string;
    /**
     * The wallet's real SOL balance at creation time. Required: a missing
     * value used to fall through to a hardcoded 42.85 SOL default, which
     * reserved every order -- for every wallet, including ones with nothing
     * in them -- against a balance nobody actually had.
     */
    actualWalletBalance: number;
  }): { success: boolean; order?: LimitOrder; error?: string } {
    if (!Number.isFinite(params.actualWalletBalance) || params.actualWalletBalance < 0) {
      return { success: false, error: 'A real wallet balance is required to size this order.' };
    }
    if (!params.tokenMint) {
      return { success: false, error: 'A token mint is required.' };
    }

    const orderId = `lim_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    // 1. Reserve balance
    const reserveToken = params.side === 'buy' ? params.tokenIn : params.tokenOut;
    const reserveAmount = params.amountIn;

    const reserveRes = limitOrderReservationEngine.reserve({
      limitOrderId: orderId,
      walletId: params.walletId,
      token: reserveToken,
      amount: reserveAmount,
      walletActualBalance: params.actualWalletBalance
    });

    if (!reserveRes.success) {
      return { success: false, error: reserveRes.error };
    }

    const order: LimitOrder = {
      id: orderId,
      userId: params.userId,
      walletId: params.walletId,
      chainId: params.chainId || 'solana',
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      tokenMint: params.tokenMint,
      side: params.side,
      targetPrice: params.targetPrice,
      amountIn: params.amountIn,
      filledAmount: 0,
      slippageBps: params.slippageBps ?? 100,
      status: 'OPEN',
      health: 'HEALTHY',
      version: 1,
      conditions: params.conditions || { maxPriceImpactPct: 3.0 },
      expiresAt: params.expiresAt,
      createdAt: now,
      updatedAt: now
    };

    limitOrderStore.set(orderId, order);

    // Initial version record
    const versionRecord: LimitOrderVersion = {
      id: `ver_1_${orderId}`,
      limitOrderId: orderId,
      version: 1,
      targetPrice: order.targetPrice,
      amountIn: order.amountIn,
      conditionsSnapshot: { ...order.conditions },
      createdAt: now
    };
    limitOrderVersionsStore.set(orderId, [versionRecord]);

    return { success: true, order };
  }

  public getLimitOrder(orderId: string): LimitOrder | undefined {
    return limitOrderStore.get(orderId);
  }

  /**
   * @param currentMarketPrice Required -- this defaulted to 0.0425, the same
   *   fabricated constant the rest of this codebase has been removing, and
   *   every order's "distance to target" was computed against it whenever a
   *   caller omitted the real price.
   * @param mint When given, only orders for this token are returned. Without
   *   it, `distancePct` below is computed against `currentMarketPrice` for
   *   every order regardless of what token it is actually for -- correct only
   *   when the caller already knows every returned order shares one mint.
   */
  public getUserLimitOrders(userId: string, currentMarketPrice: number, mint?: string): LimitOrder[] {
    const userOrders = Array.from(limitOrderStore.values())
      .filter(o => o.userId === userId)
      .filter(o => !mint || o.tokenMint === mint);

    return userOrders.map(order => {
      let distancePct = 0;
      if (currentMarketPrice > 0 && order.targetPrice > 0) {
        distancePct = ((currentMarketPrice - order.targetPrice) / order.targetPrice) * 100;
        if (order.side === 'buy') {
          distancePct = -Math.abs(distancePct); // Distance to drop
        } else {
          distancePct = Math.abs(distancePct); // Distance to rise
        }
      }

      return {
        ...order,
        distancePct: parseFloat(distancePct.toFixed(2))
      };
    });
  }

  public modifyLimitOrder(orderId: string, updates: {
    targetPrice?: number;
    amountIn?: number;
    conditions?: LimitOrderConditions;
    expiresAt?: string;
  }): { success: boolean; order?: LimitOrder; error?: string } {
    const order = limitOrderStore.get(orderId);
    if (!order) return { success: false, error: 'Order not found' };

    if (order.status === 'FILLED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
      return { success: false, error: `Cannot modify order in ${order.status} state` };
    }

    if (updates.targetPrice !== undefined) order.targetPrice = updates.targetPrice;
    if (updates.amountIn !== undefined) order.amountIn = updates.amountIn;
    if (updates.conditions !== undefined) order.conditions = { ...order.conditions, ...updates.conditions };
    if (updates.expiresAt !== undefined) order.expiresAt = updates.expiresAt;

    order.version += 1;
    order.updatedAt = new Date().toISOString();

    // Create version snapshot
    const versionRecord: LimitOrderVersion = {
      id: `ver_${order.version}_${orderId}`,
      limitOrderId: orderId,
      version: order.version,
      targetPrice: order.targetPrice,
      amountIn: order.amountIn,
      conditionsSnapshot: { ...order.conditions },
      createdAt: order.updatedAt
    };

    const versions = limitOrderVersionsStore.get(orderId) || [];
    versions.push(versionRecord);
    limitOrderVersionsStore.set(orderId, versions);

    return { success: true, order };
  }

  public cancelLimitOrder(orderId: string): { success: boolean; order?: LimitOrder; error?: string } {
    const order = limitOrderStore.get(orderId);
    if (!order) return { success: false, error: 'Order not found' };

    if (order.status === 'FILLED' || order.status === 'CANCELLED') {
      return { success: false, error: `Order is already ${order.status}` };
    }

    order.status = 'CANCELLED';
    order.health = 'INVALID';
    order.updatedAt = new Date().toISOString();

    limitOrderReservationEngine.release(orderId);

    return { success: true, order };
  }

  public evaluateAndTriggerOrder(orderId: string, market: MarketSnapshot): {
    triggered: boolean;
    executed: boolean;
    order: LimitOrder;
    report: any;
    executionError?: string;
  } {
    const order = limitOrderStore.get(orderId);
    if (!order) throw new Error(`Limit order ${orderId} not found`);

    const report = conditionEngine.evaluate(order, market);

    if (report.passed) {
      order.status = 'TRIGGERED';
      order.health = 'HEALTHY';

      // Re-evaluate via S20 OMS OrderManager
      try {
        const intentResult = orderManager.createOrderIntent({
          userId: order.userId,
          walletId: order.walletId,
          chainId: order.chainId,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          side: order.side,
          type: 'limit',
          amountIn: order.amountIn,
          slippageBps: order.slippageBps
        });

        order.status = 'EXECUTING';
        order.updatedAt = new Date().toISOString();
        limitOrderReservationEngine.consume(orderId);

        order.status = 'FILLED';
        order.filledAmount = order.amountIn;
        order.updatedAt = new Date().toISOString();

        return { triggered: true, executed: true, order, report };
      } catch (err: any) {
        order.status = 'WAITING_FOR_SAFETY';
        order.health = 'BLOCKED';
        return { triggered: true, executed: false, order, report, executionError: err.message };
      }
    } else {
      // Check if price reached but safety conditions failed
      const priceItem = report.items.find((i: any) => i.id === 'price');
      if (priceItem && priceItem.status === 'PASSED') {
        order.status = 'WAITING_FOR_SAFETY';
        order.health = report.hasUnknown ? 'WARNING' : 'BLOCKED';
      } else {
        order.status = 'MONITORING';
        order.health = 'HEALTHY';
      }

      order.updatedAt = new Date().toISOString();
      return { triggered: false, executed: false, order, report };
    }
  }

  public getOrderVersions(orderId: string): LimitOrderVersion[] {
    return limitOrderVersionsStore.get(orderId) || [];
  }
}

export const limitOrderService = new LimitOrderService();
