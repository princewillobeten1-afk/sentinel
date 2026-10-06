import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/v1/live-alerts/route';
import { NextRequest } from 'next/server';
import type { LiveTradeAlert } from '@/lib/alerts/live-alert-types';

describe('Live Alerts System (Trojan & BullX style)', () => {
  it('returns valid stream of real-time trade and call alerts', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/live-alerts?limit=15');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    body.data.forEach((alert: LiveTradeAlert) => {
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('headline');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('token');
      expect(alert.token).toHaveProperty('mint');
      expect(alert.token).toHaveProperty('symbol');
      expect(alert.token).toHaveProperty('priceUsd');
      expect(alert.token).toHaveProperty('marketCapUsd');
    });
  }, 15000);

  it('correctly filters live alerts by category', async () => {
    // 1. Calls only
    const reqCalls = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=calls');
    const resCalls = await GET(reqCalls);
    const bodyCalls = await resCalls.json();
    expect(bodyCalls.success).toBe(true);
    expect(bodyCalls.data.length).toBeGreaterThan(0);
    bodyCalls.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('CALL');
      expect(alert.caller).toBeDefined();
    });

    // 2. Whale trades only
    const reqTrades = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=trades');
    const resTrades = await GET(reqTrades);
    const bodyTrades = await resTrades.json();
    expect(bodyTrades.success).toBe(true);
    expect(bodyTrades.data.length).toBeGreaterThan(0);
    bodyTrades.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('WHALE_TRADE');
      expect(alert.trade).toBeDefined();
      expect(alert.trade?.amountSol).toBeGreaterThan(0);
    });

    // 3. Smart Money only
    const reqSmart = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=smart_money');
    const resSmart = await GET(reqSmart);
    const bodySmart = await resSmart.json();
    expect(bodySmart.success).toBe(true);
    expect(bodySmart.data.length).toBeGreaterThan(0);
    bodySmart.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('SMART_MONEY');
    });

    // 4. Launchpad Milestones only
    const reqLaunchpad = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=launchpad');
    const resLaunchpad = await GET(reqLaunchpad);
    const bodyLaunchpad = await resLaunchpad.json();
    expect(bodyLaunchpad.success).toBe(true);
    expect(bodyLaunchpad.data.length).toBeGreaterThan(0);
    bodyLaunchpad.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('LAUNCHPAD_MILESTONE');
      expect(alert.milestone).toBeDefined();
    });

    // 5. Insiders only
    const reqInsiders = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=insiders');
    const resInsiders = await GET(reqInsiders);
    const bodyInsiders = await resInsiders.json();
    expect(bodyInsiders.success).toBe(true);
    expect(bodyInsiders.data.length).toBeGreaterThan(0);
    bodyInsiders.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('INSIDER_ACTIVITY');
    });

    // 6. Developers only
    const reqDevs = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=developers');
    const resDevs = await GET(reqDevs);
    const bodyDevs = await resDevs.json();
    expect(bodyDevs.success).toBe(true);
    expect(bodyDevs.data.length).toBeGreaterThan(0);
    bodyDevs.data.forEach((alert: LiveTradeAlert) => {
      expect(alert.type).toBe('DEV_ACTIVITY');
    });
  }, 15000);

  it('filters live trades by minimum SOL threshold', async () => {
    const minSol = 10;
    const req = new NextRequest(`http://localhost:3000/api/v1/live-alerts?minSol=${minSol}`);
    const res = await GET(req);
    const body = await res.json();
    expect(body.success).toBe(true);

    body.data.forEach((alert: LiveTradeAlert) => {
      if (alert.trade && alert.trade.direction !== 'TRANSFER') {
        expect(alert.trade.amountSol).toBeGreaterThanOrEqual(minSol);
      }
    });
  }, 15000);

  it('attaches quick-buy defaults and caller stats', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/live-alerts?category=calls');
    const res = await GET(req);
    const body = await res.json();
    expect(body.success).toBe(true);

    const callAlert: LiveTradeAlert = body.data[0];
    if (callAlert) {
      expect(callAlert.quickBuyDefaultSol).toBeDefined();
      expect(callAlert.quickBuyDefaultSol).toBeGreaterThan(0);
      expect(callAlert.caller?.name).toBeDefined();
      expect(typeof callAlert.caller?.isVerified).toBe('boolean');
    }
  }, 15000);
});
