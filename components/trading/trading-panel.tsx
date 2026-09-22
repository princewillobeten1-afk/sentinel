'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wallet, Settings2, ChevronDown, Plus, Megaphone, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { LimitOrderBuilder } from '@/components/limit-orders/limit-order-builder';
import { useTradeSidebar } from '@/lib/hooks/use-trade-sidebar';
import { summarizePosition, TRADE_PRESETS } from '@/lib/trading/sidebar-model';
import { TradeActivityStrip, TradeSidebarInfo } from './trade-sidebar-info';
import { usePrimaryWallet, useConnectWallet, useNotificationsActions, useWalletState, useWalletActions } from '@/lib/store';
import type { Quote } from '@/lib/quote/types';
import { simulateTradeExecution, submitTradeOrder } from '@/lib/trading/service';
import type { TransactionExecutionState } from '@/lib/trading/types';
import { signatureToBase58 } from '@/lib/wallet/siws';
import { Decimal } from '@/lib/math/decimal';
import { TransactionPreviewModal } from './transaction-preview-modal';

interface TradingPanelProps {
  tokenSymbol: string;
  tokenMint: string;
  tokenPriceUsd: string;
  initialInputAmount?: string;
  initialSlippage?: number;
  initialSide?: 'buy' | 'sell';
}

export function TradingPanel({
  tokenSymbol,
  tokenMint,
  tokenPriceUsd,
  initialInputAmount = '0.5',
  initialSlippage = 0.5,
  initialSide = 'buy',
}: TradingPanelProps) {
  const { primaryWallet, address } = usePrimaryWallet();
  const { selectedAdapter } = useWalletState();
  const { recordTradeExecution } = useWalletActions();
  const { openModal: openWalletModal } = useConnectWallet();
  const { addNotification, addExecutionLog } = useNotificationsActions();

  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [inputAmount, setInputAmount] = useState(initialInputAmount);
  const [slippage, setSlippage] = useState(initialSlippage);
  const [customSlippage, setCustomSlippage] = useState('');
  const [isCustomSlippage, setIsCustomSlippage] = useState(false);
  const sidebar = useTradeSidebar(tokenMint, address || primaryWallet?.address || null);
  const position = summarizePosition(sidebar.position);
  const walletBalanceSol = sidebar.position?.balanceSol ?? null;
  const [orderMode, setOrderMode] = useState<'market' | 'simple' | 'advanced'>('market');
  const [showStrategy, setShowStrategy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [presets, setPresets] = useState(TRADE_PRESETS);
  const [editingPreset, setEditingPreset] = useState(false);
  const [presetDraft, setPresetDraft] = useState('');
  const [presetError, setPresetError] = useState('');
  const [calloutOpen, setCalloutOpen] = useState(false);
  const [callout, setCallout] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const quoteRequest = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sentinel.trade.presets.v1') || 'null');
      if (Array.isArray(saved) && saved.length === 3 && saved.every(p =>
        Array.isArray(p.amounts) && p.amounts.length === 4 && p.amounts.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0)
        && typeof p.slippage === 'number' && p.slippage > 0 && p.slippage <= 50)) setPresets(saved);
    } catch { /* Storage is optional; defaults remain usable. */ }
  }, []);

  useEffect(() => {
    if (initialSide) setSide(initialSide);
  }, [initialSide]);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [showAdvancedRoute, setShowAdvancedRoute] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [transactionState, setTransactionState] = useState<TransactionExecutionState>('idle');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);
  const [simulationErrors, setSimulationErrors] = useState<string[]>([]);
  const [simulationWarnings, setSimulationWarnings] = useState<string[]>([]);
  const [simulationTxHash, setSimulationTxHash] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const effectiveSlippage = isCustomSlippage ? Number(customSlippage) : slippage;
  const validSlippage = Number.isFinite(effectiveSlippage) && effectiveSlippage > 0 && effectiveSlippage <= 50;
  const isHighSlippage = effectiveSlippage > 3.0;

  useEffect(() => {
    setInputAmount(initialInputAmount);
  }, [initialInputAmount, tokenMint]);

  // Fetch authoritative quote whenever input, side, or slippage changes
  const updateQuote = useCallback(async (requestId: number, signal: AbortSignal) => {
    if (!inputAmount || !Number.isFinite(Number(inputAmount)) || Number(inputAmount) <= 0 || !validSlippage) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    setIsQuoteLoading(true);
    setQuoteError(null);

    try {
      // Mints, not symbols. The previous call passed 'SOL' and a symbol into a
      // client-side router that applied one hardcoded rate to every pair, which
      // is how the panel came to offer SOL in exchange for SOL.
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const res = await fetch('/api/v1/trading/quote', {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          inputMint: side === 'buy' ? SOL_MINT : tokenMint,
          outputMint: side === 'buy' ? tokenMint : SOL_MINT,
          inputSymbol: side === 'buy' ? 'SOL' : tokenSymbol,
          outputSymbol: side === 'buy' ? tokenSymbol : 'SOL',
          amount: inputAmount,
          slippage: effectiveSlippage,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data?.quote) {
        throw new Error(body?.error?.message || `Quote unavailable (${res.status})`);
      }
      if (requestId === quoteRequest.current && !signal.aborted) setQuote(body.data.quote);
    } catch (err: any) {
      if (requestId !== quoteRequest.current || signal.aborted) return;
      setQuoteError(err.message || 'Failed to fetch quote');
      setQuote(null);
    } finally {
      if (requestId === quoteRequest.current && !signal.aborted) setIsQuoteLoading(false);
    }
  }, [inputAmount, side, effectiveSlippage, validSlippage, tokenSymbol, tokenMint]);

  useEffect(() => {
    const requestId = ++quoteRequest.current;
    const controller = new AbortController();
    setQuote(null);
    setQuoteError(null);
    setIsQuoteLoading(false);
    const timer = setTimeout(() => {
      void updateQuote(requestId, controller.signal);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [updateQuote]);

  // Quick Percentage Amount Handlers (25%, 50%, 75%, MAX)
  const handleQuickPercent = (percent: number) => {
    if (!primaryWallet) return;
    const maxAvailable = side === 'buy' ? walletBalanceSol : position.quantity;
    if (maxAvailable === null) return;
    const portion = String(maxAvailable * (percent / 100));
    setInputAmount(portion);
  };

  const formatPreviewError = (technical: string): string => {
    if (technical.toLowerCase().includes('on-chain swap execution is not configured')) {
      return 'Live swap execution is not configured for this environment. No wallet transaction was signed or broadcast.';
    }
    if (technical.toLowerCase().includes('price impact') || technical.toLowerCase().includes('slippage')) {
      return 'The trade could not be simulated because the expected price moved beyond your selected slippage. Review the quote and try again.';
    }
    if (technical.toLowerCase().includes('expired')) {
      return 'The quote expired before the trade could be simulated. Refresh the quote and confirm again.';
    }
    if (technical.toLowerCase().includes('insufficient')) {
      return 'Your wallet does not hold enough balance to execute this order. Adjust the amount or switch wallets.';
    }
    if (technical.toLowerCase().includes('route failure')) {
      return 'Unable to construct a valid route for this swap. Try a smaller size or different market.';
    }
    return 'The trade could not be simulated. Review the quote and try again.';
  };

  const handleOpenPreview = async () => {
    if (!primaryWallet) {
      openWalletModal();
      return;
    }
    if (!quote) return;

    const stableKey = `${quote.id}:${address || primaryWallet.address}`;
    setIdempotencyKey(stableKey);
    setSimulationErrors([]);
    setSimulationWarnings([]);
    setSimulationTxHash(null);
    setExecutionError(null);
    setTransactionState('preparing');
    setIsSimulationLoading(true);
    setIsPreviewOpen(true);

    try {
      const result = await simulateTradeExecution(quote, address || primaryWallet.address, walletBalanceSol ?? 0, 'solana:mainnet');
      setSimulationErrors(result.errors);
      setSimulationWarnings(result.warnings);
      setSimulationTxHash(result.simulatedTxHash || null);

      if (!result.valid) {
        setTransactionState('failed');
        setExecutionError(formatPreviewError(result.errors[0] || 'Simulation failed.'));
        addExecutionLog({
          text: `[SIMULATION] Trade simulation failed for ${side.toUpperCase()} order on ${quote.provider}.`,
          level: 'warn',
        });
      } else {
        setTransactionState('idle');
        addExecutionLog({
          text: `[SIMULATION] Trade simulation passed. Prepared payload for ${side.toUpperCase()} order.`,
          level: 'info',
        });
      }
    } catch (err: any) {
      const technical = err.message || 'Unknown error';
      setTransactionState('failed');
      setExecutionError(formatPreviewError(technical));
      setSimulationErrors([technical]);
      setSimulationWarnings([]);
      addExecutionLog({
        text: `[SIMULATION] Error while simulating trade: ${technical}`,
        level: 'error',
      });
    } finally {
      setIsSimulationLoading(false);
    }
  };

  const handleConfirmTrade = async () => {
    if (!quote || !selectedAdapter || simulationErrors.length > 0) return;
    const walletAddress = address || primaryWallet?.address;
    if (!walletAddress) {
      addNotification({
        title: 'Execution Failed',
        message: 'No connected wallet found for transaction signing.',
        type: 'system',
      });
      setTransactionState('failed');
      setExecutionError('No connected wallet found for transaction signing.');
      return;
    }

    setExecutionError(null);
    setTransactionState('awaitingWallet');

    addExecutionLog({
      text: `[TERMINAL-EXEC] Requesting wallet signature for ${side.toUpperCase()} order...`,
      level: 'info',
    });

    try {
      const payload = new TextEncoder().encode(JSON.stringify({
        quoteId: quote.id,
        quote,
        wallet: walletAddress,
        network: 'solana:mainnet',
        simulationTxHash,
      }));

      const signatureBytes = await selectedAdapter.signMessage(payload);
      setTransactionState('signing');

      const signatureBase58 = signatureToBase58(signatureBytes);
      setTransactionState('submitting');

      const confirmedTrade = await submitTradeOrder(
        quote,
        walletAddress,
        signatureBase58,
        'solana:mainnet',
        idempotencyKey ?? `${quote.id}:${walletAddress}`
      );
      setTransactionState('confirming');

      if (confirmedTrade.status === 'confirmed') {
        setTransactionState('confirmed');
        setIsPreviewOpen(false);

        const solAmount = side === 'buy' ? Number(inputAmount) : Number(quote.outputAmount);
        const tokenAmount = side === 'buy' ? Number(quote.outputAmount) : Number(inputAmount);
        const numPriceUsd =
          parseFloat(tokenPriceUsd) ||
          Number(quote.estimatedPriceUsd) ||
          (side === 'buy' && tokenAmount > 0 ? (solAmount * 170) / tokenAmount : 0.042);

        recordTradeExecution({
          side,
          tokenSymbol,
          tokenMint,
          tokenName: tokenSymbol,
          amountSol: solAmount,
          tokenAmount,
          priceUsd: numPriceUsd,
          txHash: confirmedTrade.txHash,
        });

        addNotification({
          title: `Order Submitted`,
          message: `Your ${side.toUpperCase()} order was submitted as ${confirmedTrade.txHash}.`,
          type: 'execution',
        });
      } else {
        setTransactionState('failed');
        setExecutionError('The swap execution returned a failed status.');
      }

      addExecutionLog({
        text: `[TERMINAL-EXEC] SUBMITTED: Swap Tx ${confirmedTrade.txHash} via ${quote.provider}`,
        level: confirmedTrade.status === 'confirmed' ? 'success' : 'error',
      });
    } catch (err: any) {
      const technical = err.message || 'Wallet signing or submission error';
      const friendly = technical.toLowerCase().includes('reject')
        ? 'The wallet signature was rejected. Approve the transaction in your wallet to continue.'
        : technical.toLowerCase().includes('expire')
        ? 'The quote expired before submission. Refresh and confirm again.'
        : 'The trade could not be submitted. Confirm the quote and try again.';

      const nextState = technical.toLowerCase().includes('reject')
        ? 'rejected'
        : technical.toLowerCase().includes('expire')
        ? 'expired'
        : 'failed';

      setTransactionState(nextState);
      setExecutionError(friendly);

      addNotification({
        title: 'Execution Failed',
        message: friendly,
        type: 'system',
      });
      addExecutionLog({
        text: `[TERMINAL-EXEC] FAILED: ${technical}`,
        level: 'error',
      });
    }
  };

  const editPreset = () => {
    setPresetDraft(presets[activePreset].amounts.join(', '));
    setPresetError('');
    setEditingPreset(true);
  };
  const savePreset = () => {
    const amounts = presetDraft.split(',').map(value => Number(value.trim()));
    if (amounts.length !== 4 || amounts.some(value => !Number.isFinite(value) || value <= 0) || !validSlippage) {
      setPresetError('Enter four positive SOL amounts, separated by commas, and valid slippage.');
      return;
    }
    const next = presets.map((preset, index) => index === activePreset ? { amounts, slippage: effectiveSlippage } : preset);
    setPresets(next);
    try { localStorage.setItem('sentinel.trade.presets.v1', JSON.stringify(next)); } catch { /* Session-only when storage is blocked. */ }
    setEditingPreset(false);
  };
  const usd = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, notation: 'compact' }).format(value);
  const available = primaryWallet ? (side === 'buy' ? walletBalanceSol : position.quantity) : null;

  return (
    <section aria-label="Token order panel" className="trade-execution-panel min-w-0 rounded-md border border-sentinel-800 bg-sentinel-950 p-3 text-xs">
      <TradeActivityStrip data={sidebar.data} />
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-sentinel-800 p-1" aria-label="Trade direction">
        {(['buy', 'sell'] as const).map(direction => <button type="button" key={direction} aria-pressed={side === direction}
          onClick={() => { setSide(direction); setInputAmount(direction === 'buy' ? String(presets[activePreset].amounts[0]) : ''); }}
          className={`min-h-8 rounded font-semibold ${side === direction ? direction === 'buy' ? 'bg-emerald-400 text-slate-950' : 'bg-rose-500 text-white' : 'text-slate-400 hover:bg-sentinel-800'}`}>
          {direction === 'buy' ? 'Buy' : 'Sell'}
        </button>)}
      </div>
      <div className="flex items-center justify-between gap-1 border-b border-sentinel-800">
        <div className="flex items-center gap-3" aria-label="Order type">
          {([{mode: 'market', label: 'Market'}, {mode: 'simple', label: 'Limit'}, {mode: 'advanced', label: 'Adv.'}] as const).map(item =>
            <button type="button" key={item.mode} aria-pressed={orderMode === item.mode} onClick={() => setOrderMode(item.mode)}
              className={`min-h-9 border-b text-[11px] font-semibold ${orderMode === item.mode ? 'border-sky-400 text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>{item.label}</button>)}
        </div>
        <button type="button" onClick={openWalletModal} className="flex min-w-0 items-center gap-1 text-[11px] text-slate-400" aria-label={primaryWallet ? 'Manage trading wallet' : 'Connect trading wallet'}
          title={address || primaryWallet?.address || 'No wallet connected'}><Wallet className="h-3 w-3 shrink-0" /><span className="truncate">{primaryWallet ? walletBalanceSol === null ? 'Balance —' : `${walletBalanceSol.toFixed(3)} SOL` : 'Connect'}</span><ChevronDown className="h-3 w-3 shrink-0" /></button>
      </div>
      <div className="mt-3 rounded-md border border-sentinel-800 bg-sentinel-900/40">
        <div className="flex items-center gap-2 px-2">
          <label htmlFor="trade-amount" className="text-[11px] uppercase text-slate-500">Amount</label>
          <input id="trade-amount" type="number" min="0" step="any" inputMode="decimal" value={inputAmount} onChange={e => setInputAmount(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-right font-numeric text-slate-100" placeholder="0.0" />
          <span title={side === 'buy' ? 'SOL' : tokenSymbol} className="max-w-16 truncate text-[11px] text-slate-400">{side === 'buy' ? 'SOL' : tokenSymbol}</span>
        </div>
        <div className="flex border-t border-sentinel-800">
          {(side === 'buy' ? presets[activePreset].amounts : [25, 50, 75, 100]).map((amount, index) =>
            <button type="button" key={index} disabled={side === 'sell' && (available === null || available <= 0)}
              onClick={() => side === 'buy' ? setInputAmount(String(amount)) : handleQuickPercent(amount)}
              className="min-h-7 min-w-0 flex-1 border-r border-sentinel-800 font-numeric text-[11px] text-slate-300 hover:bg-sentinel-800 disabled:opacity-40">
              {side === 'buy' ? amount : `${amount}%`}
            </button>)}
          <button type="button" onClick={editPreset} aria-label="Edit amount presets" className="px-2 text-slate-400 hover:text-sky-400"><Pencil className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Balance {available === null ? '—' : available.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
        <button type="button" onClick={() => setShowSettings(value => !value)} aria-expanded={showSettings} className="flex items-center gap-1 py-1 text-slate-400">
          <Settings2 className="h-3 w-3" /> {validSlippage ? effectiveSlippage : '—'}% slippage
        </button>
      </div>
      <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-500">
        <span title="Network fee from the current quote">Fee {quote?.networkFeeSol != null ? `${new Decimal(quote.networkFeeSol).formatToken(6)} SOL` : '—'}</span>
        <span title="Custom priority fees are not supported by the current quote API">Priority: provider</span>
        <span title="Jito tip configuration is not connected">Tip: —</span>
        <span title="MEV protection status is not supplied by the execution provider">MEV: —</span>
      </div>
      {showSettings && <div className="mt-2 space-y-2 rounded-md border border-sentinel-800 p-2">
        <span className="text-[11px] text-slate-400">Slippage tolerance</span>
        <div className="grid grid-cols-4 gap-1">
          {[0.1, 0.5, 1].map(value => <button type="button" key={value} aria-pressed={!isCustomSlippage && slippage === value}
            onClick={() => { setSlippage(value); setIsCustomSlippage(false); }}
            className={`min-h-8 rounded border text-[11px] ${!isCustomSlippage && slippage === value ? 'border-sky-500 text-sky-400' : 'border-sentinel-800 text-slate-400'}`}>{value}%</button>)}
          <button type="button" aria-pressed={isCustomSlippage} onClick={() => setIsCustomSlippage(true)} className="rounded border border-sentinel-800 text-[11px] text-slate-300">Custom</button>
        </div>
        {isCustomSlippage && <Input aria-label="Custom slippage percent" type="number" min="0.01" max="50" step="0.1" value={customSlippage} onChange={e => setCustomSlippage(e.target.value)} placeholder="Slippage %" />}
        <p className="text-[11px] text-slate-500">Priority fees are provider-managed. Custom tips and MEV controls are not connected.</p>
      </div>}
      {!validSlippage && <p role="alert" className="mt-1 text-[11px] text-amber-400">Enter slippage greater than 0 and at most 50%.</p>}
      {isHighSlippage && <p role="status" className="mt-1 text-[11px] text-amber-400">High slippage increases execution risk.</p>}
      <label className="mt-3 flex min-h-7 cursor-pointer items-center gap-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={showStrategy} onChange={e => setShowStrategy(e.target.checked)} className="accent-sky-500" />
        Advanced Trading Strategy
      </label>
      {showStrategy && <div className="mb-2 space-y-1">
        <button type="button" onClick={() => setOrderMode('advanced')} className="flex min-h-8 w-full items-center justify-between rounded border border-sentinel-800 px-2 text-[11px] text-sky-400">Add strategy<Plus className="h-3 w-3" /></button>
        <p className="text-[11px] text-slate-500">Opens a separate conditional order; not attached to this market trade.</p>
      </div>}
      <div className="my-2 break-words text-[11px] text-slate-400" aria-live="polite">
        {isQuoteLoading ? 'Fetching quote…' : quote ? `Est. receive ${new Decimal(quote.outputAmount).formatToken(4)} ${side === 'buy' ? tokenSymbol : 'SOL'}` : 'Est. receive —'}
      </div>
      {quoteError && <p role="alert" className="mb-2 break-words text-[11px] text-amber-400">{quoteError}</p>}
      {!primaryWallet ? <Button variant="buy" className="min-h-10 w-full" onClick={openWalletModal}>Connect Wallet to Trade</Button> :
        <Button variant={side === 'buy' ? 'buy' : 'sell'} className="min-h-10 w-full truncate" title={tokenSymbol} onClick={handleOpenPreview}
          disabled={!quote || isQuoteLoading || !validSlippage || quote.isValid === false}>
          Preview {side === 'buy' ? 'Buy' : 'Sell'} {tokenSymbol}
        </Button>}
      {quote && <div className="mt-2 text-[11px]">
        <button type="button" onClick={() => setShowAdvancedRoute(value => !value)} aria-expanded={showAdvancedRoute} className="flex w-full items-center justify-between text-slate-500">
          Quote details<ChevronDown className="h-3 w-3" />
        </button>
        {showAdvancedRoute && <dl className="mt-1 grid grid-cols-2 gap-1 text-slate-400">
          <dt>Provider</dt><dd className="text-right">{quote.provider}</dd>
          <dt>Minimum received</dt><dd className="text-right">{new Decimal(quote.minimumReceived).formatToken(4)}</dd>
          <dt>Price impact</dt><dd className="text-right">{quote.priceImpact}%</dd>
        </dl>}
      </div>}
      <button type="button" onClick={() => { setCallout(`${tokenSymbol} on Sentinel\n${window.location.origin}/trade/solana/${tokenMint}`); setCopyStatus(''); setCalloutOpen(true); }}
        className="my-3 flex w-full items-center gap-2 rounded-md border border-sentinel-800 bg-sentinel-900/40 p-2 text-left">
        <Megaphone className="h-4 w-4 shrink-0 text-sky-400" /><span className="min-w-0"><span className="block text-[11px] font-semibold text-slate-200">Make a callout</span><span className="block text-[11px] text-slate-500">Draft a post to copy and share</span></span>
      </button>
      <div className="grid grid-cols-4 divide-x divide-sentinel-800 border-y border-sentinel-800 py-2 text-[11px]" aria-label="Wallet position">
        {[['Bought', position.boughtUsd], ['Sold', position.soldUsd], ['Holding', position.holdingUsd], ['PnL', position.pnlUsd]].map(([label, value]) =>
          <div key={String(label)} className="min-w-0 px-1" title={`${label}: wallet position in USD. ${sidebar.positionError || sidebar.position?.pnlEvidence?.reason || 'Birdeye all-time weighted-average-cost estimate.'}`}>
            <span className="text-slate-500">{label}</span><span className={`block truncate font-numeric ${label === 'PnL' && typeof value === 'number' ? value < 0 ? 'text-rose-400' : 'text-emerald-400' : 'text-slate-300'}`}>{usd(value as number | null)}</span>
          </div>)}
      </div>
      {sidebar.positionError && <p className="mt-1 text-[11px] text-slate-500" role="status">{sidebar.positionError}</p>}
      <div className="my-2 flex items-center gap-1" aria-label="Trading presets">
        {presets.map((preset, index) => <button type="button" key={index} aria-pressed={activePreset === index}
          onClick={() => { setActivePreset(index); setSlippage(preset.slippage); setIsCustomSlippage(false); if (side === 'buy') setInputAmount(String(preset.amounts[0])); }}
          className={`min-h-7 flex-1 rounded text-[11px] ${activePreset === index ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:bg-sentinel-800'}`}>PRESET {index + 1}</button>)}
        <button type="button" onClick={editPreset} aria-label="Configure selected preset" className="p-1 text-sky-400"><Settings2 className="h-3.5 w-3.5" /></button>
      </div>
      <TradeSidebarInfo data={sidebar.data} loading={sidebar.loading} error={sidebar.error} refresh={sidebar.refresh} />
      {orderMode !== 'market' && <LimitOrderBuilder initialMode={orderMode} initialSide={side}
        currentPrice={Number(sidebar.data.priceUsd ?? tokenPriceUsd)} walletBalanceSol={walletBalanceSol ?? 0}
        walletAddress={address || primaryWallet?.address || null} tokenMint={tokenMint} tokenSymbol={tokenSymbol}
        onClose={() => setOrderMode('market')} onOrderCreated={() => { setOrderMode('market'); sidebar.refresh(); }} />}
      <Modal isOpen={editingPreset} onClose={() => setEditingPreset(false)} title={`Configure preset ${activePreset + 1}`} size="sm">
        <label className="block space-y-2 text-xs text-slate-300">Four buy amounts (SOL)
          <Input value={presetDraft} onChange={e => setPresetDraft(e.target.value)} placeholder="0.01, 0.1, 1, 10" />
        </label>
        <p className="my-3 text-xs text-slate-500">Also saves the current slippage setting. Sell shortcuts use percentages of your recorded token holding.</p>
        {presetError && <p role="alert" className="mb-2 text-xs text-amber-400">{presetError}</p>}
        <Button onClick={savePreset}>Save preset</Button>
      </Modal>
      <Modal isOpen={calloutOpen} onClose={() => setCalloutOpen(false)} title="Make a callout" size="sm">
        <p className="mb-3 text-xs text-slate-400">Draft only. Nothing is published automatically; Sentinel has no callout feed connected.</p>
        <textarea aria-label="Callout draft" value={callout} onChange={e => setCallout(e.target.value)} rows={5} className="w-full rounded-md border border-sentinel-700 bg-sentinel-900 p-2 text-sm text-slate-200" />
        <Button className="mt-3" onClick={async () => { try { await navigator.clipboard.writeText(callout); setCopyStatus('Callout copied'); } catch { setCopyStatus('Copy unavailable. Select and copy the draft manually.'); } }}>Copy callout</Button>
        <p role="status" className="mt-2 text-xs text-slate-400">{copyStatus}</p>
      </Modal>

      {/* Transaction Preview Modal */}
      <TransactionPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setTransactionState('idle');
          setExecutionError(null);
        }}
        quote={quote}
        side={side}
        onConfirmExecute={handleConfirmTrade}
        executionState={transactionState}
        executionError={executionError}
        isExecuting={
          transactionState === 'awaitingWallet' ||
          transactionState === 'signing' ||
          transactionState === 'submitting' ||
          transactionState === 'confirming'
        }
        simulationErrors={simulationErrors}
        simulationWarnings={simulationWarnings}
        isSimulationLoading={isSimulationLoading}
      />
    </section>
  );
}
