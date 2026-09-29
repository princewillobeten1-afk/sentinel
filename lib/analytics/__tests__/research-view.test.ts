// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AnalyticsResearchView } from '@/components/views/analytics-research-view';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('research workspace', () => {
  it('shows evidence limitations instead of fabricated performance on every section', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(React.createElement(AnalyticsResearchView, { onBack: vi.fn() }));
    expect(screen.getByRole('heading', { name: 'Research workspace' })).toBeTruthy();
    expect(screen.queryByText('MEME_FRENZY')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Volume quality' }));
    expect(screen.getByText(/Non-organic volume is not automatically wash trading/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit capacity' }));
    expect(screen.getByText(/cannot estimate slippage or exitability/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Token rankings' }));
    expect(await screen.findByText(/Measured token rankings are unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wallet activity' }));
    expect(screen.getByRole('heading', { name: 'Observed wallet activity' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'My orders' }));
    expect(await screen.findByText(/Order history is unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Backtest' }));
    expect(screen.getByRole('heading', { name: 'Measured historical backtest' })).toBeTruthy();
  });
});
