import { describe, it, expect, beforeEach } from 'vitest';
import { adminTreasuryService } from '../treasury';

describe('Protocol Treasury & Revenue Attribution (Sprint 39 §32-35)', () => {
  beforeEach(() => {
    adminTreasuryService.reset();
  });

  it('calculates total treasury balance across multi-chain and fiat stable reserves', () => {
    const balances = adminTreasuryService.getTreasuryBalances();

    expect(balances.length).toBeGreaterThan(0);
    expect(balances.some((b) => b.symbol === 'SOL')).toBe(true);
    expect(balances.some((b) => b.symbol === 'USDC')).toBe(true);
  });

  it('provides revenue breakdown across 4 protocol monetization streams', () => {
    const rev = adminTreasuryService.getRevenueSummary();

    expect(rev.period24hUsd).toBeGreaterThan(0);
    expect(rev.streams.tradingFeesUsd).toBeGreaterThan(0);
    expect(rev.streams.launchpadFeesUsd).toBeGreaterThan(0);
    expect(rev.streams.aiSubscriptionsUsd).toBeGreaterThan(0);
    expect(rev.streams.apiDeveloperRevenueUsd).toBeGreaterThan(0);
  });

  it('updates fee configuration and validates limits', () => {
    const updated = adminTreasuryService.updateFeeConfiguration(
      { swapRoutingFeePct: 0.3 },
      { updatedBy: 'admin_finance', updatedByRole: 'FINANCE', reason: 'Lowered swap fee' }
    );

    expect(updated.swapRoutingFeePct).toBe(0.3);
  });

  it('rejects invalid or unsafe fee percentages (<0 or >10%)', () => {
    expect(() => {
      adminTreasuryService.updateFeeConfiguration(
        { swapRoutingFeePct: 15.0 },
        { updatedBy: 'admin_finance', updatedByRole: 'FINANCE', reason: 'Excessive fee rate' }
      );
    }).toThrow(/Invalid swap fee percentage/);
  });
});
