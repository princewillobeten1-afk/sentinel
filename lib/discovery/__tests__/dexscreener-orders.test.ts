import { describe, it, expect, beforeEach } from 'vitest';
import { summariseOrders, __resetDexPaidCache } from '../dexscreener-orders';

describe('summariseOrders — Dex Paid is an approved order, not a boost', () => {
  beforeEach(() => __resetDexPaidCache());

  it('reports paid when an order is approved', () => {
    // The live shape, from /orders/v1/solana/<mint>.
    const status = summariseOrders([
      {
        chainId: 'solana',
        type: 'tokenProfile',
        status: 'approved',
        paymentTimestamp: 1_788_472_477_988,
      },
    ]);

    expect(status.isDexPaid).toBe(true);
    expect(status.paidAt).toBe(1_788_472_477_988);
    expect(status.types).toEqual(['tokenProfile']);
  });

  it('does not report paid for an order that was only attempted', () => {
    // Somebody starting a purchase is not a paid listing. Rendering the badge
    // for `processing` would advertise spend that has not been approved.
    expect(summariseOrders([{ type: 'tokenProfile', status: 'processing' }]).isDexPaid).toBe(false);
    expect(summariseOrders([{ type: 'tokenProfile', status: 'rejected' }]).isDexPaid).toBe(false);
    expect(summariseOrders([{ type: 'tokenProfile', status: 'cancelled' }]).isDexPaid).toBe(false);
  });

  it('reports not paid for an empty order list', () => {
    const status = summariseOrders([]);
    expect(status.isDexPaid).toBe(false);
    expect(status.paidAt).toBeNull();
  });

  it('takes the earliest approved payment as the paid-since date', () => {
    // "How long has this been paid for" — a later top-up must not reset the
    // age to today, which is what a max or a last-write would do.
    const status = summariseOrders([
      { type: 'tokenAd', status: 'approved', paymentTimestamp: 3_000 },
      { type: 'tokenProfile', status: 'approved', paymentTimestamp: 1_000 },
      { type: 'trendingBarAd', status: 'approved', paymentTimestamp: 2_000 },
    ]);

    expect(status.paidAt).toBe(1_000);
    expect(status.types).toHaveLength(3);
  });

  it('ignores an unapproved order when a separate approved one exists', () => {
    const status = summariseOrders([
      { type: 'tokenAd', status: 'rejected', paymentTimestamp: 500 },
      { type: 'tokenProfile', status: 'approved', paymentTimestamp: 9_000 },
    ]);

    expect(status.isDexPaid).toBe(true);
    expect(status.paidAt).toBe(9_000);
    expect(status.types).toEqual(['tokenProfile']);
  });

  it('reports paid with a null date when no timestamp is given', () => {
    // Approved but undated is still paid; the badge shows without an age.
    const status = summariseOrders([{ type: 'tokenProfile', status: 'approved' }]);
    expect(status.isDexPaid).toBe(true);
    expect(status.paidAt).toBeNull();
  });

  it('treats a missing list as not paid rather than throwing', () => {
    expect(summariseOrders(null).isDexPaid).toBe(false);
    expect(summariseOrders(undefined).isDexPaid).toBe(false);
  });
});
