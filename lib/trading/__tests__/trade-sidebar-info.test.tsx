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

  it('credits the holder count to the DEX route when the ownership audit is unavailable', async () => {
    render(<TradeSidebarInfo data={{ mint: 'mint', holdersCount: 1,
      marketEvidence: { status: 'measured', source: 'jupiter-token-api', observedAt: new Date().toISOString() },
      ownershipEvidence: { status: 'unavailable', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);
    fireEvent.focus(screen.getByLabelText('Holders', { exact: true }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('Jupiter');
  });

  it('qualifies an LP lock reading as the deepest reported pool', async () => {
    render(<TradeSidebarInfo data={{ mint: 'mint', lpLockedPct: 100,
      liquidityEvidence: { status: 'measured', source: 'rugcheck-largest-pool-lock', observedAt: new Date().toISOString() },
    }} loading={false} refresh={() => {}} />);
    fireEvent.focus(screen.getByLabelText('LP Locked', { exact: true }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('deepest liquidity pool');
  });
});
