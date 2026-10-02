import { describe, it, expect } from 'vitest';
import { GET as getWalletDetail } from '@/app/api/v1/smart-wallets/[address]/route';

describe('GET /api/v1/smart-wallets/[address] — Wallet Performance & Win/Loss API', () => {
  it('returns 400 when address is missing or empty', async () => {
    const req = new Request('http://localhost:3000/api/v1/smart-wallets/');
    const res = await getWalletDetail(req, { params: { address: '' } });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('returns full performance metrics, win rate, and equity curve for a valid wallet', async () => {
    const testAddress = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
    const req = new Request(`http://localhost:3000/api/v1/smart-wallets/${testAddress}`);
    const res = await getWalletDetail(req, { params: { address: testAddress } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.fullAddress).toBe(testAddress);
    expect(json.data.winRate).toBeGreaterThan(0);
    expect(json.data.totalWins).toBeGreaterThan(0);
    expect(json.data.totalLosses).toBeGreaterThanOrEqual(0);
    expect(json.data.totalTrades).toBe(json.data.totalWins + json.data.totalLosses);
    expect(Array.isArray(json.data.equityCurve)).toBe(true);
    expect(json.data.equityCurve.length).toBeGreaterThan(0);
    expect(Array.isArray(json.data.trades)).toBe(true);
    expect(json.data.trades.length).toBeGreaterThan(0);

    expect(Array.isArray(json.data.activePositions)).toBe(true);
    expect(json.data.activePositions.length).toBeGreaterThan(0);
    expect(json.data.activePositions[0]).toHaveProperty('boughtUsd');
    expect(json.data.activePositions[0]).toHaveProperty('remainingUsd');
    expect(json.data.activePositions[0]).toHaveProperty('dexBadge');

    expect(Array.isArray(json.data.activityHeatmap)).toBe(true);
    expect(json.data.activityHeatmap.length).toBe(7);

    expect(json.data.performance.roiBuckets).toBeDefined();
    expect(json.data.performance.roiBuckets).toHaveProperty('gt500');
    expect(json.data.performance.roiBuckets).toHaveProperty('from0to200');

    expect(json.data.balance).toBeDefined();
    expect(json.data.balance.totalValueUsd).toBeGreaterThan(0);
    expect(json.data.balance.walletFundingAge).toBeDefined();

    // Verify individual trade properties
    const firstTrade = json.data.trades[0];
    expect(firstTrade).toHaveProperty('tokenSymbol');
    expect(firstTrade).toHaveProperty('isWin');
    expect(firstTrade).toHaveProperty('pnlUsd');
    expect(firstTrade).toHaveProperty('pnlPercent');
    expect(firstTrade).toHaveProperty('holdingDuration');
  });

  it('produces deterministic stats for the same wallet address', async () => {
    const addr = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
    const req1 = new Request(`http://localhost:3000/api/v1/smart-wallets/${addr}`);
    const res1 = await getWalletDetail(req1, { params: { address: addr } });
    const json1 = await res1.json();

    const req2 = new Request(`http://localhost:3000/api/v1/smart-wallets/${addr}`);
    const res2 = await getWalletDetail(req2, { params: { address: addr } });
    const json2 = await res2.json();

    expect(json1.data.winRate).toBe(json2.data.winRate);
    expect(json1.data.totalRealizedPnl).toBe(json2.data.totalRealizedPnl);
    expect(json1.data.trades.length).toBe(json2.data.trades.length);
  });
});
