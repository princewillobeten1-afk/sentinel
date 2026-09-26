// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TokenDiscoveryCard } from '@/components/discovery/token-card';
import type { DiscoveryToken } from '@/lib/discovery/types';

const actions = vi.hoisted(() => ({ push: vi.fn(), toggleWatchlist: vi.fn(), quickBuy: vi.fn(), hide: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock('@/lib/store', () => ({ useAppActions: () => ({ setQuickBuyOpen: actions.quickBuy, addNotification: vi.fn(), setSelectedToken: vi.fn(), setActiveView: vi.fn() }) }));
vi.mock('@/lib/store/watchlist-store', () => ({ useWatchlist: () => ({ isWatchlisted: () => false, toggleWatchlist: actions.toggleWatchlist }) }));
vi.mock('@/lib/store/token-filters-store', () => ({ useTokenFilters: () => ({ hideToken: actions.hide, blacklistDev: vi.fn(), muteSocial: vi.fn(), isTokenHidden: () => false, isDevBlacklisted: () => false, isSocialMuted: () => false }) }));
vi.mock('@/components/ui/legend-tooltip', () => ({ LegendTooltip: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children) }));

const token = {
  id: 'card-test', mint: 'So11111111111111111111111111111111111111112',
  symbol: 'TEST', name: 'A very long token name that should remain available in its tooltip',
  chain: 'solana', source: 'Pump.fun', ageMinutes: 2, priceUsd: '0.001',
  marketCapUsd: '10000', liquidityUsd: '5000', liquidityPoolAddress: 'confirmed-pool',
  twitterHandle: '@test_token', twitterUrl: 'https://x.com/test_token',
  bondingCurveProgress: 85,
} as DiscoveryToken;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('compact Discover card interactions', () => {
  it('opens the trade route from the card, without changing the route contract', () => {
    render(React.createElement(TokenDiscoveryCard, { token }));
    fireEvent.keyDown(screen.getByRole('link', { name: 'Trade TEST' }), { key: 'Enter' });
    expect(actions.push).toHaveBeenCalledWith(`/trade/solana/${token.mint}`);
  });

  it('keeps the full name and real social link accessible', () => {
    render(React.createElement(TokenDiscoveryCard, { token }));
    expect(screen.getAllByTitle(token.name).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '@test_token' }).getAttribute('href')).toBe(token.twitterUrl);
  });

  it('expands security evidence without navigating and never turns missing stale flags into No', () => {
    render(React.createElement(TokenDiscoveryCard, { token: { ...token, securityEvidence: { status: 'stale', source: 'test', observedAt: '2026-01-01T00:00:00Z' } } }));
    expect(screen.queryByRole('region', { name: 'Security evidence for TEST' })).toBeNull();
    const trigger = screen.getByRole('button', { name: 'Safety details for TEST' });
    fireEvent.click(trigger);
    const details = screen.getByRole('region', { name: 'Security evidence for TEST' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(details.id);
    expect(details.textContent).not.toMatch(/NaN|undefined|No/);
    expect(actions.push).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(screen.queryByRole('region', { name: 'Security evidence for TEST' })).toBeNull();
  });

  it('keeps watchlist and Quick Buy isolated from card navigation', () => {
    const quickBuy = vi.fn();
    render(React.createElement(TokenDiscoveryCard, { token, onQuickBuy: quickBuy, quickBuyPresets: [0.1] }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle watchlist' }));
    expect(actions.toggleWatchlist).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Quick buy TEST for 0.1 SOL' }));
    expect(quickBuy).toHaveBeenCalledWith(token, 0.1);
    expect(actions.push).not.toHaveBeenCalled();
  });

  it('enables Quick Buy for new pairs and final stretch bonding curve tokens', () => {
    const quickBuy = vi.fn();
    render(React.createElement(TokenDiscoveryCard, {
      token: {
        ...token,
        liquidityPoolAddress: undefined,
        source: 'Pump.fun',
        bondingCurveProgress: 85,
      },
      onQuickBuy: quickBuy,
    }));
    const buy = screen.getByRole('button', { name: 'Quick buy TEST for 0.05 SOL' });
    expect((buy as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(buy);
    expect(quickBuy).toHaveBeenCalled();
  });

  it('does not enable Quick Buy without a confirmed venue or mint', () => {
    render(React.createElement(TokenDiscoveryCard, {
      token: {
        ...token,
        mint: '',
        source: 'Unknown' as any,
        bondingCurveProgress: undefined,
        liquidityPoolAddress: undefined,
        liquidityUsd: '0',
      },
    }));
    const buy = screen.getByRole('button', { name: 'Quick buy TEST for 0.05 SOL' });
    expect((buy as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buy);
    expect(actions.quickBuy).not.toHaveBeenCalled();
  });

  it('dismisses card actions with Escape or outside click and restores keyboard focus', () => {
    render(React.createElement(TokenDiscoveryCard, { token }));
    const trigger = screen.getByRole('button', { name: 'Token actions for TEST' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Hide token' })).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Hide token' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menuitem', { name: 'Hide token' })).toBeNull();
    expect(actions.push).not.toHaveBeenCalled();
  });
});
