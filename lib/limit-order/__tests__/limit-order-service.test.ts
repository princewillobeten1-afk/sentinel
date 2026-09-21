import { describe, it, expect } from 'vitest';
import { LimitOrderService } from '../limit-order-service';

const MINT = '3j5JjNkpuzKcwq28W2rJeRGKsYPPDdZTTpe2BTu8HWL6';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** A fresh wallet id per test, since the reservation engine is a module-level
 *  singleton with no reset -- reusing one would leak reservations across
 *  cases and make balance checks depend on run order. */
const wallet = () => `wallet_${Math.random().toString(36).slice(2)}`;

const baseParams = (overrides: Partial<Parameters<LimitOrderService['createLimitOrder']>[0]> = {}) => {
  const w = wallet();
  return {
    userId: w,
    walletId: w,
    tokenIn: SOL_MINT,
    tokenOut: MINT,
    tokenMint: MINT,
    side: 'buy' as const,
    targetPrice: 0.001,
    amountIn: 1,
    actualWalletBalance: 5,
    ...overrides,
  };
};

describe('LimitOrderService.createLimitOrder', () => {
  it('creates an order carrying the real token mint', () => {
    const service = new LimitOrderService();
    const result = service.createLimitOrder(baseParams());

    expect(result.success).toBe(true);
    expect(result.order?.tokenMint).toBe(MINT);
  });

  it('rejects a missing wallet balance rather than defaulting to 42.85', () => {
    // The route validates this before calling the service, but the service
    // must refuse it too -- it is the layer that used to silently substitute
    // 42.85 SOL for every wallet regardless of what they actually held.
    const service = new LimitOrderService();
    const result = service.createLimitOrder(
      baseParams({ actualWalletBalance: Number.NaN }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/balance/i);
  });

  it('rejects a negative wallet balance', () => {
    const service = new LimitOrderService();
    const result = service.createLimitOrder(baseParams({ actualWalletBalance: -1 }));

    expect(result.success).toBe(false);
  });

  it('rejects an order with no token mint', () => {
    const service = new LimitOrderService();
    const result = service.createLimitOrder(baseParams({ tokenMint: '' }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mint/i);
  });

  it('refuses to reserve more than the real balance allows', () => {
    const service = new LimitOrderService();
    const result = service.createLimitOrder(
      baseParams({ actualWalletBalance: 0.5, amountIn: 1 }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient/i);
  });
});

describe('LimitOrderService.getUserLimitOrders', () => {
  it('scopes orders to the requesting wallet only', () => {
    const service = new LimitOrderService();
    const a = baseParams();
    const b = baseParams();

    service.createLimitOrder(a);
    service.createLimitOrder(b);

    const ordersForA = service.getUserLimitOrders(a.userId, 0.001);
    expect(ordersForA).toHaveLength(1);
    expect(ordersForA[0].userId).toBe(a.userId);
  });

  it('filters to one token when a mint is given', () => {
    const service = new LimitOrderService();
    const w = wallet();
    const otherMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

    service.createLimitOrder(baseParams({ userId: w, walletId: w, tokenMint: MINT, tokenOut: MINT }));
    service.createLimitOrder(
      baseParams({ userId: w, walletId: w, tokenMint: otherMint, tokenOut: otherMint }),
    );

    const filtered = service.getUserLimitOrders(w, 0.001, MINT);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tokenMint).toBe(MINT);

    const unfiltered = service.getUserLimitOrders(w, 0.001);
    expect(unfiltered).toHaveLength(2);
  });

  it('computes distance-to-target from the price actually passed in, not a fabricated default', () => {
    const service = new LimitOrderService();
    const params = baseParams({ side: 'buy', targetPrice: 0.001 });
    service.createLimitOrder(params);

    // Buy waiting for the price to drop to target: at a current price above
    // target, distance should be negative (price must fall).
    const [order] = service.getUserLimitOrders(params.userId, 0.002);
    expect(order.distancePct).toBeLessThan(0);
  });
});
