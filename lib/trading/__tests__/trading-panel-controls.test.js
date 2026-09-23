// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TradingPanel } from '@/components/trading/trading-panel';

const mocks = vi.hoisted(() => ({ wallet: null, position: null, submit: vi.fn(), simulate: vi.fn() }));
vi.mock('@/lib/store', () => ({
  usePrimaryWallet: () => ({ primaryWallet: mocks.wallet, address: mocks.wallet?.address ?? null, balanceSol: 2 }),
  useWalletState: () => ({ selectedAdapter: null }),
  useWalletActions: () => ({ recordTradeExecution: vi.fn() }),
  useConnectWallet: () => ({ openModal: vi.fn() }),
  useNotificationsActions: () => ({ addNotification: vi.fn(), addExecutionLog: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-trade-sidebar', () => ({ useTradeSidebar: () => ({ data: { mint: 'mint' }, position: mocks.position, loading: false, refresh: vi.fn() }) }));
vi.mock('@/lib/trading/service', () => ({ submitTradeOrder: mocks.submit, simulateTradeExecution: mocks.simulate }));
vi.mock('@/components/trading/transaction-preview-modal', () => ({ TransactionPreviewModal: () => null }));
vi.mock('@/components/limit-orders/limit-order-builder', () => ({ LimitOrderBuilder: props => React.createElement('div', { 'data-testid': 'builder' }, `${props.initialMode}:${props.initialSide}`) }));
const mount = () => render(React.createElement(TradingPanel, { tokenMint: 'mint', tokenSymbol: 'TOKEN', tokenPriceUsd: '1' }));
const response = value => ({ ok: true, json: async () => ({ data: { quote: { id: value, outputAmount: value, minimumReceived: value, priceImpact: 0, provider: 'fixture', isValid: true } } }) });
beforeEach(() => {
  mocks.wallet = null; mocks.position = null;
  const storage = new Map();
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('100')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.simulate).not.toHaveBeenCalled(); });

describe('compact trading rail controls', () => {
  it('amount buttons and persistent presets update the real order amount', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '0.01', exact: true }));
    expect(screen.getByLabelText('Amount').value).toBe('0.01');
    fireEvent.click(screen.getByRole('button', { name: 'PRESET 2' }));
    expect(screen.getByLabelText('Amount').value).toBe('0.05');
    fireEvent.click(screen.getByRole('button', { name: 'Edit amount presets' }));
    fireEvent.change(screen.getByLabelText('Four buy amounts (SOL)'), { target: { value: '0.2, 0.4, 0.8, 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save preset' }));
    expect(JSON.parse(localStorage.getItem('sentinel.trade.presets.v1'))[1].amounts).toEqual([0.2, 0.4, 0.8, 2]);
    fireEvent.click(screen.getByRole('button', { name: '0.4', exact: true }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toMatchObject({ amount: '0.4', slippage: 1 });
  });
  it('sell percentages require a real holding', () => {
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Sell', exact: true }));
    expect(screen.getByRole('button', { name: '50%' }).disabled).toBe(true);
    mocks.wallet = { address: 'wallet' }; mocks.position = { quantity: 80 };
    view.rerender(React.createElement(TradingPanel, { tokenMint: 'mint', tokenSymbol: 'TOKEN', tokenPriceUsd: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(Number(screen.getByLabelText('Amount').value)).toBe(40);
  });
  it('keeps automated orders unavailable without a wallet-authorized trigger path', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Limit' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Adv.' }).disabled).toBe(true);
    expect(screen.queryByTestId('builder')).toBeNull();
  });
  it('does not allow a late quote to overwrite a newer amount', async () => {
    let resolveOld;
    fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue(response('222'));
    mount(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2' } });
    await waitFor(() => expect(screen.getByText(/Est. receive 222/)).toBeTruthy());
    resolveOld(response('111'));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(screen.queryByText(/Est. receive 111/)).toBeNull();
  });
  it('shows a quote failure and leaves unknown Dex Paid unclassified', async () => {
    fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { message: 'No route available' } }) });
    mount();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No route available'));
    expect(screen.queryByText('Unpaid', { exact: true })).toBeNull();
    expect(screen.getByText('LP Locked')).toBeTruthy();
  });
});
