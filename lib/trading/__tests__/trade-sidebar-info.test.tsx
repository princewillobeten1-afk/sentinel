// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TradeSidebarInfo } from '@/components/trading/trade-sidebar-info';

afterEach(cleanup);

describe('trade sidebar evidence labels', () => {
  it('renders unknown classification counts without formatting null as a number', () => {
    render(<TradeSidebarInfo data={{ mint: 'mint', devHoldingsPct: 0, devCount: null,
      ownershipEvidence: { status: 'measured', source: 'rugcheck-report', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);
    expect(screen.getByText('Dev H.')).toBeTruthy();
  });

  it('credits the holder count to the market feed without exposing third-party provider names', async () => {
    render(<TradeSidebarInfo data={{ mint: 'mint', holdersCount: 1,
      marketEvidence: { status: 'measured', source: 'jupiter-token-api', observedAt: new Date().toISOString() },
      ownershipEvidence: { status: 'unavailable', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);
    fireEvent.focus(screen.getByLabelText('Holders', { exact: true }));
    const tooltip = (await screen.findByRole('tooltip')).textContent ?? '';
    expect(tooltip).toContain('Market feed');
    expect(tooltip).not.toMatch(/jupiter|birdeye/i);
  });

  it('qualifies an LP lock reading as the deepest reported pool', async () => {
    render(<TradeSidebarInfo data={{ mint: 'mint', lpLockedPct: 100,
      liquidityEvidence: { status: 'measured', source: 'rugcheck-largest-pool-lock', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);
    fireEvent.focus(screen.getByLabelText('LP Locked', { exact: true }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('deepest liquidity pool');
  });

  it('clamps pro traders count so it never exceeds total holders count', () => {
    const { container } = render(<TradeSidebarInfo data={{
      mint: 'mint',
      holdersCount: 17,
      proTradersCount: 59,
      ownershipEvidence: { status: 'measured', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);

    // Pro traders should be clamped to total holders (17), never 59
    expect(screen.queryByText('59')).toBeNull();
    expect(screen.getAllByText('17').length).toBeGreaterThanOrEqual(1);
  });

  it('colors LP Locked 100% as safe emerald and Top 10 31.8% as normal slate', () => {
    const { container } = render(<TradeSidebarInfo data={{
      mint: 'mint',
      top10HoldingsPct: 31.8,
      lpLockedPct: 100,
      ownershipEvidence: { status: 'measured', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
      liquidityEvidence: { status: 'measured', source: 'rugcheck-largest-pool-lock', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);

    const lpValue = screen.getByText('100.0%');
    expect(lpValue.className).toContain('text-emerald-400');

    const top10Value = screen.getByText('31.8%');
    expect(top10Value.className).not.toContain('text-rose-400');
    expect(top10Value.className).toContain('text-slate-200');
  });
});
