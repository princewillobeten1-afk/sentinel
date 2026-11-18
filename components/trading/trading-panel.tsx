'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wallet, Settings2, ChevronDown, Megaphone, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useTradeSidebar } from '@/lib/hooks/use-trade-sidebar';
import { summarizePosition, TRADE_PRESETS } from '@/lib/trading/sidebar-model';
import { TradeActivityStrip, TradeSidebarInfo } from './trade-sidebar-info';
import { usePrimaryWallet, useConnectWallet, useNotificationsActions, useWalletState, useWalletActions } from '@/lib/store';
import type { Quote } from '@/lib/quote/types';
import { Decimal } from '@/lib/math/decimal';
import { TransactionPreviewModal } from './transaction-preview-modal';
import { useSwapExecution } from '@/lib/hooks/use-swap-execution';
import { useEvmSwapExecution } from '@/lib/hooks/use-evm-swap-execution';
import { formatDisplaySource } from '@/lib/discovery/format';
import { ROBINHOOD_WETH_ADDRESS, getExplorerTxUrl } from '@/lib/chains/chain-config';

interface TradingPanelProps {
  tokenSymbol: string;
  tokenMint: string;
  chain?: string;
  tokenPriceUsd: string;
  initialInputAmount?: string;
  initialSlippage?: number;
  initialSide?: 'buy' | 'sell';
}

export function TradingPanel({
  tokenSymbol,
  tokenMint,
  chain = 'solana',
  initialInputAmount = '0.5',
  initialSlippage = 0.5,
  initialSide = 'buy',
}: TradingPanelProps) {
  const isRobinhood = chain?.toLowerCase() === 'robinhood';
  const nativeSymbol = isRobinhood ? 'ETH' : 'SOL';
  const normalizedChain = isRobinhood ? 'robinhood' : 'solana';

  const { primaryWallet, address } = usePrimaryWallet();
  const { selectedAdapter, evmAddress, evmBalanceEth, isWrongEvmNetwork } = useWalletState();
  const { switchToRobinhoodChain, refreshEvmBalance } = useWalletActions();
  const { openModal: openWalletModal } = useConnectWallet();
  const { addExecutionLog } = useNotificationsActions();
  const activeChainWallet = isRobinhood ? evmAddress : (address || primaryWallet?.address || null);
  const solanaExecution = useSwapExecution(address || primaryWallet?.address || null, tokenMint, selectedAdapter);
  const evmExecution = useEvmSwapExecution(evmAddress, tokenMint, {
    switchToRobinhoodChain,
    refreshEvmBalance,
  });
  const execution = isRobinhood ? evmExecution : solanaExecution;
  const [reviewQuote, setReviewQuote] = useState<Quote | null>(null);
  const [reviewSlippage, setReviewSlippage] = useState(initialSlippage);

  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [inputAmount, setInputAmount] = useState(initialInputAmount);
  const [slippage, setSlippage] = useState(initialSlippage);
  const [customSlippage, setCustomSlippage] = useState('');
  const [isCustomSlippage, setIsCustomSlippage] = useState(false);
  const sidebar = useTradeSidebar(tokenMint, activeChainWallet, normalizedChain);
  const position = summarizePosition(sidebar.position);
  const walletBalanceSol = isRobinhood ? evmBalanceEth : (sidebar.position?.balanceSol ?? null);
  const isWalletConnected = isRobinhood ? Boolean(evmAddress) : Boolean(primaryWallet);
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
  const [quoteClock, setQuoteClock] = useState(Date.now());
  useEffect(() => {
    if (!quote) return;
    const timer = setInterval(() => setQuoteClock(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [quote]);
  const quoteExpired = !!quote?.expiresAt && Date.parse(quote.expiresAt) <= quoteClock;

  const [showAdvancedRoute, setShowAdvancedRoute] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const effectiveSlippage = isCustomSlippage ? Number(customSlippage) : slippage;
  const validSlippage = Number.isFinite(effectiveSlippage) && effectiveSlippage > 0 && effectiveSlippage <= 15;
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
      const NATIVE_MINT = isRobinhood ? ROBINHOOD_WETH_ADDRESS : 'So11111111111111111111111111111111111111112';
      const res = await fetch('/api/v1/trading/quote', {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chain: normalizedChain,
          inputMint: side === 'buy' ? NATIVE_MINT : tokenMint,
          outputMint: side === 'buy' ? tokenMint : NATIVE_MINT,
          inputSymbol: side === 'buy' ? nativeSymbol : tokenSymbol,
          outputSymbol: side === 'buy' ? tokenSymbol : nativeSymbol,
          amount: inputAmount,
          slippage: effectiveSlippage,
          walletAddress: isRobinhood ? (evmAddress ?? undefined) : undefined,
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data?.quote) {
        throw new Error(body?.error?.message || `Quote unavailable (${res.status})`);
      }
      if (requestId === quoteRequest.current && !signal.aborted) {
        setQuoteClock(Date.now());
        setQuote(body.data.quote);
      }
    } catch (err: any) {
      if (requestId !== quoteRequest.current || signal.aborted) return;
      setQuoteError(err.message || 'Failed to fetch quote');
      setQuote(null);
    } finally {
      if (requestId === quoteRequest.current && !signal.aborted) setIsQuoteLoading(false);
    }
  }, [inputAmount, side, effectiveSlippage, validSlippage, tokenSymbol, tokenMint, isRobinhood, normalizedChain, nativeSymbol, evmAddress]);

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
    if (!isWalletConnected) return;
    const maxAvailable = side === 'buy' ? walletBalanceSol : position.quantity;
    if (maxAvailable === null) return;
    const portion = String(maxAvailable * (percent / 100));
    setInputAmount(portion);
  };

  const handleOpenPreview = () => {
    if (!isWalletConnected) { openWalletModal(); return; }
    if (isRobinhood && (isWrongEvmNetwork || quote?.executionSupported === false)) return;
    if (!quote || execution.pending || execution.busy) return;
    if (quoteExpired) { setQuoteError('Quote expired. Refresh it before reviewing a trade.'); return; }
    setReviewQuote(quote);
    setReviewSlippage(effectiveSlippage);
    setIsPreviewOpen(true);
    addExecutionLog({
      text: isRobinhood
        ? '[TRADE] Review Robinhood Chain swap before EVM wallet approval.'
        : '[TRADE] Review Solana mainnet swap before wallet approval.',
      level: 'info',
    });
  };
  const handleConfirmTrade = () => {
    if (!reviewQuote) return;
    if (Date.parse(reviewQuote.expiresAt) <= Date.now()) {
      setIsPreviewOpen(false);
      setQuoteError('Quote expired while reviewing. Refresh it before trading.');
      return;
    }
    void execution.execute(reviewQuote, reviewSlippage);
  };

  const editPreset = () => {
    setPresetDraft(presets[activePreset].amounts.join(', '));
    setPresetError('');
    setEditingPreset(true);
  };
  const savePreset = () => {
    const amounts = presetDraft.split(',').map(value => Number(value.trim()));
    if (amounts.length !== 4 || amounts.some(value => !Number.isFinite(value) || value <= 0) || !validSlippage) {
      setPresetError(`Enter four positive ${nativeSymbol} amounts, separated by commas, and valid slippage.`);
      return;
    }
    const next = presets.map((preset, index) => index === activePreset ? { amounts, slippage: effectiveSlippage } : preset);
    setPresets(next);
    try { localStorage.setItem('sentinel.trade.presets.v1', JSON.stringify(next)); } catch { /* Session-only when storage is blocked. */ }
    setEditingPreset(false);
  };
  const usd = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, notation: 'compact' }).format(value);
  const available = isWalletConnected ? (side === 'buy' ? walletBalanceSol : position.quantity) : null;

  return (
    <section aria-label="Token order panel" className="trade-execution-panel min-w-0 rounded-[8px] border border-[#1E222D] bg-[#0D1015] p-3 text-xs">
      <TradeActivityStrip data={sidebar.data} />
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-[8px] border border-[#1E222D] bg-[#080A0F] p-1" aria-label="Trade direction">
        {(['buy', 'sell'] as const).map(direction => (
          <button
            type="button"
            key={direction}
            aria-pressed={side === direction}
            onClick={() => {
              setSide(direction);
              setInputAmount(direction === 'buy' ? String(presets[activePreset].amounts[0]) : '');
            }}
            className={`min-h-8 rounded-[6px] font-bold text-xs transition-all ${
              side === direction
                ? direction === 'buy'
                  ? 'bg-[#2FE3AC] text-[#04130E] shadow-[0_0_14px_rgba(47,227,172,0.28)]'
                  : 'bg-[#EC397A] text-white shadow-[0_0_14px_rgba(236,57,122,0.28)]'
                : 'text-[#828598] hover:text-[#F7F8F9] hover:bg-[#151821]'
            }`}
          >
            {direction === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-1 border-b border-[#1E222D]">
        <div className="flex items-center gap-3" aria-label="Order type">
          {([{mode: 'market', label: 'Market'}, {mode: 'simple', label: 'Limit'}, {mode: 'advanced', label: 'Adv.'}] as const).map(item =>
            <button type="button" key={item.mode} aria-pressed={item.mode === 'market'} disabled={item.mode !== 'market'}
              title={item.mode !== 'market' ? 'Automated orders require a separate wallet-authorized execution path.' : undefined}
              className={`min-h-9 border-b-2 text-[11px] font-semibold ${item.mode === 'market' ? 'border-[#526FFF] text-[#F7F8F9]' : 'border-transparent text-[#525866] opacity-60'}`}>{item.label}</button>)}
        </div>
        <button type="button" onClick={openWalletModal} className="flex min-w-0 items-center gap-1 text-[11px] text-[#828598] hover:text-[#F7F8F9] transition-colors" aria-label={isWalletConnected ? 'Manage trading wallet' : 'Connect trading wallet'}
          title={activeChainWallet || 'No wallet connected'}><Wallet className="h-3 w-3 shrink-0" /><span className="truncate">{isWalletConnected ? walletBalanceSol === null ? 'Balance —' : `${walletBalanceSol.toFixed(3)} ${nativeSymbol}` : 'Connect'}</span><ChevronDown className="h-3 w-3 shrink-0" /></button>
      </div>
      <div className="mt-3 rounded-[8px] border border-[#1E222D] focus-within:border-[#526FFF]/60 bg-[#080A0F] overflow-hidden transition-colors">
        <div className="flex items-center gap-2 px-2.5">
          <label htmlFor="trade-amount" className="text-[11px] uppercase text-[#828598]">Amount</label>
          <input id="trade-amount" type="number" min="0" step="any" inputMode="decimal" value={inputAmount} onChange={e => setInputAmount(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-right font-numeric text-[#F7F8F9] outline-none" placeholder="0.0" />
          <span title={side === 'buy' ? nativeSymbol : tokenSymbol} className="max-w-16 truncate text-[11px] text-[#828598]">{side === 'buy' ? nativeSymbol : tokenSymbol}</span>
        </div>
        <div className="flex border-t border-[#1E222D]">
          {(side === 'buy' ? presets[activePreset].amounts : [25, 50, 75, 100]).map((amount, index) => {
            const isAmountActive = side === 'buy' && String(amount) === inputAmount;
            return (
              <button
                type="button"
                key={index}
                disabled={side === 'sell' && (available === null || available <= 0)}
                onClick={() => (side === 'buy' ? setInputAmount(String(amount)) : handleQuickPercent(amount))}
                className={`min-h-7 min-w-0 flex-1 border-r border-[#1E222D] font-numeric text-[11px] transition-colors disabled:opacity-40 ${
                  isAmountActive
                    ? 'bg-[#526FFF]/20 text-[#8EA2FF] font-semibold'
                    : 'bg-[#11141B] text-[#C8C9D1] hover:bg-[#1C202B]'
                }`}
              >
                {side === 'buy' ? amount : `${amount}%`}
              </button>
            );
          })}
          <button type="button" onClick={editPreset} aria-label="Edit amount presets" className="px-2 bg-[#11141B] text-[#828598] hover:text-[#8EA2FF] hover:bg-[#1C202B] transition-colors"><Pencil className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Balance {available === null ? '—' : available.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
        <button type="button" onClick={() => setShowSettings(value => !value)} aria-expanded={showSettings} className="flex items-center gap-1 py-1 text-slate-400">
          <Settings2 className="h-3 w-3" /> {validSlippage ? effectiveSlippage : '—'}% slippage
        </button>
      </div>
      <div className="flex flex-wrap gap-x-2 text-[11px] text-slate-500">
        <span title="Network fee from the current quote">Fee {quote?.networkFeeSol != null ? `${new Decimal(quote.networkFeeSol).formatToken(6)} ${nativeSymbol}` : '—'}</span>
        <span title="Priority fees are calculated automatically">{isRobinhood ? 'Gas: EIP-1559' : 'Priority: auto'}</span>
        {!isRobinhood && <span title="Jito tip configuration is not connected">Tip: —</span>}
        {!isRobinhood && <span title="MEV protection status is not available for this route">MEV: —</span>}
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
        <p className="text-[11px] text-slate-500">Priority fees are calculated automatically. Custom tips and MEV controls are not connected.</p>
      </div>}
      {!validSlippage && <p role="alert" className="mt-1 text-[11px] text-amber-400">Enter slippage greater than 0 and at most 15%.</p>}
      {isHighSlippage && <p role="status" className="mt-1 text-[11px] text-amber-400">High slippage increases execution risk.</p>}
      <p className="mt-3 text-[11px] text-slate-500">Limit and advanced orders are unavailable until a wallet-authorized trigger path is configured.</p>
      <div className="my-2 break-words text-[11px] text-slate-400" aria-live="polite">
        {isQuoteLoading ? 'Fetching quote…' : quoteExpired ? 'Quote expired — refresh for a new estimate'
          : quote ? `Est. receive ${new Decimal(quote.outputAmount).formatToken(4)} ${side === 'buy' ? tokenSymbol : nativeSymbol}` : 'Est. receive —'}
      </div>
      <p className="mb-2 text-[11px] text-amber-300">
        {isRobinhood ? 'Robinhood Chain mainnet (ID 4663) · EVM wallet required' : 'Solana mainnet · real funds · wallet approval required'}
      </p>
      <button type="button" disabled={isQuoteLoading || execution.busy || execution.pending} className="mb-2 min-h-8 text-[11px] text-sky-300 disabled:opacity-50"
        onClick={() => { const requestId = ++quoteRequest.current; void updateQuote(requestId, new AbortController().signal); }}>Refresh quote</button>
      {(execution.error || execution.receipt || execution.pending) && <div role="status" className="mb-2 space-y-1 break-words text-[11px] text-slate-300">
        <p>{execution.state === 'confirmed' ? 'Swap confirmed on-chain.' : execution.error || 'Transaction submitted; awaiting confirmation.'}</p>
        {execution.receipt?.txSignature && <a className="text-sky-300 underline" href={getExplorerTxUrl(normalizedChain, execution.receipt.txSignature)} target="_blank" rel="noreferrer">View transaction</a>}
        {execution.pending && <button type="button" className="block min-h-8 text-sky-300" onClick={() => void execution.checkStatus()}>Check existing transaction</button>}
      </div>}
      {quoteError && <p role="alert" className="mb-2 break-words text-[11px] text-amber-400">{quoteError}</p>}
      {isRobinhood && quote?.executionSupported === false && (
        <p role="status" className="mb-2 rounded-md border border-amber-500/40 bg-amber-950/30 p-2 text-[11px] text-amber-300">
          {quote.unavailableReason || 'Direct swap execution is not yet verified for this Robinhood Chain DEX router. Live pool price quote is shown above.'}
        </p>
      )}
      {isRobinhood ? (
        !evmAddress ? (
          <Button variant="buy" className="min-h-10 w-full font-bold" onClick={openWalletModal}>Connect EVM Wallet to Trade</Button>
        ) : isWrongEvmNetwork ? (
          <Button
            variant="outline"
            className="min-h-10 w-full font-bold border-amber-500/50 text-amber-300 hover:bg-amber-950/30"
            onClick={() => void switchToRobinhoodChain()}
          >
            Switch to Robinhood Chain (4663)
          </Button>
        ) : quote?.executionSupported === false ? (
          <Button variant="outline" className="min-h-10 w-full font-bold opacity-70" disabled>
            Swap Unavailable on This DEX Router
          </Button>
        ) : (
          <Button variant={side === 'buy' ? 'buy' : 'sell'} className="min-h-10 w-full truncate font-bold shadow-sm" title={tokenSymbol} onClick={handleOpenPreview}
            disabled={!quote || quoteExpired || isQuoteLoading || !validSlippage || quote.isValid === false || execution.pending || execution.busy}>
            {isQuoteLoading ? 'Fetching Quote…' : `Preview ${side === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`}
          </Button>
        )
      ) : !primaryWallet ? <Button variant="buy" className="min-h-10 w-full font-bold" onClick={openWalletModal}>Connect Wallet to Trade</Button> :
        <Button variant={side === 'buy' ? 'buy' : 'sell'} className="min-h-10 w-full truncate font-bold shadow-sm" title={tokenSymbol} onClick={handleOpenPreview}
          disabled={!quote || quoteExpired || isQuoteLoading || !validSlippage || quote.isValid === false || execution.pending || execution.busy}>
          {isQuoteLoading ? 'Fetching Quote…' : `Preview ${side === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`}
        </Button>}
      {quote && <div className="mt-2 text-[11px]">
        <button type="button" onClick={() => setShowAdvancedRoute(value => !value)} aria-expanded={showAdvancedRoute} className="flex w-full items-center justify-between text-slate-500">
          Quote details<ChevronDown className="h-3 w-3" />
        </button>
        {showAdvancedRoute && <dl className="mt-1 grid grid-cols-2 gap-1 text-slate-400">
          <dt>Routing</dt><dd className="text-right">Automatic</dd>
          <dt>Minimum received</dt><dd className="text-right">{new Decimal(quote.minimumReceived).formatToken(4)}</dd>
          <dt>Price impact</dt><dd className="text-right">{quote.priceImpactMeasured === false ? 'Unavailable' : `${quote.priceImpact}%`}</dd>
        </dl>}
      </div>}
      <button type="button" onClick={() => { setCallout(`${tokenSymbol} on Phivex\n${window.location.origin}/trade/${normalizedChain}/${tokenMint}`); setCopyStatus(''); setCalloutOpen(true); }}
        className="my-3 flex w-full items-center gap-2 rounded-[8px] border border-[#1E222D] bg-[#11141B] hover:border-[#32374A] hover:bg-[#151821] p-2.5 text-left transition-colors">
        <Megaphone className="h-4 w-4 shrink-0 text-[#526FFF]" /><span className="min-w-0"><span className="block text-[11px] font-semibold text-[#F7F8F9]">Make a callout</span><span className="block text-[11px] text-[#828598]">Draft a post to copy and share</span></span>
      </button>
      <div className="grid grid-cols-4 divide-x divide-[#1E222D] border-y border-[#1E222D] bg-[#0A0D12] py-2 text-[11px]" aria-label="Wallet position">
        {[['Bought', position.boughtUsd], ['Sold', position.soldUsd], ['Holding', position.holdingUsd], ['PnL', position.pnlUsd]].map(([label, value]) =>
          <div key={String(label)} className="min-w-0 px-1.5" title={`${label}: wallet position in USD. ${label === 'Holding' && sidebar.position?.holdingEvidence ? `${formatDisplaySource(sidebar.position.holdingEvidence.source)}; ${sidebar.position.holdingEvidence.status}.` : sidebar.position?.pnlEvidence ? `${formatDisplaySource(sidebar.position.pnlEvidence.source)}; ${sidebar.position.pnlEvidence.status}.` : sidebar.positionError || 'Connect a linked wallet to load its position.'}`}>
            <span className="text-[#828598]">{label}</span><span className={`block truncate font-numeric font-medium ${label === 'PnL' && typeof value === 'number' ? value < 0 ? 'text-[#EC397A]' : 'text-[#2FE3AC]' : 'text-[#F7F8F9]'}`}>{usd(value as number | null)}</span>
          </div>)}
      </div>
      {!activeChainWallet ? <p className="mt-1 text-[11px] text-[#828598]" role="status">Connect a wallet to see its position.</p>
        : isRobinhood ? <p className="mt-1 text-[11px] text-[#828598]" role="status">Per-token EVM PnL history is unavailable; native balance shown above.</p>
        : sidebar.positionLoading ? <p className="mt-1 text-[11px] text-[#828598]" role="status">Loading wallet position…</p>
          : sidebar.positionError ? <p className="mt-1 text-[11px] text-[#FFB224]" role="status">{sidebar.positionError}</p>
            : sidebar.position?.pnlEvidence?.status === 'unavailable' ? <p className="mt-1 text-[11px] text-[#828598]" role="status">Bought, sold and PnL are not yet available for this token.</p> : null}
      <div className="my-2 flex items-center gap-1" aria-label="Trading presets">
        {presets.map((preset, index) => <button type="button" key={index} aria-pressed={activePreset === index}
          onClick={() => { setActivePreset(index); setSlippage(preset.slippage); setIsCustomSlippage(false); if (side === 'buy') setInputAmount(String(preset.amounts[0])); }}
          className={`min-h-7 flex-1 rounded-[6px] border text-[11px] font-mono transition-colors ${activePreset === index ? 'bg-[#526FFF]/15 border-[#526FFF]/35 text-[#8EA2FF] font-semibold' : 'bg-[#11141B] border-[#1E222D] text-[#828598] hover:text-[#F7F8F9] hover:bg-[#1C202B]'}`}>PRESET {index + 1}</button>)}
        <button type="button" onClick={editPreset} aria-label="Configure selected preset" className="p-1.5 rounded-[6px] hover:bg-[#1C202B] text-[#8EA2FF] transition-colors"><Settings2 className="h-3.5 w-3.5" /></button>
      </div>
      <TradeSidebarInfo data={sidebar.data} loading={sidebar.loading} error={sidebar.error} refresh={sidebar.refresh} chain={normalizedChain} />
      <Modal isOpen={editingPreset} onClose={() => setEditingPreset(false)} title={`Configure preset ${activePreset + 1}`} size="sm">
        <label className="block space-y-2 text-xs text-slate-300">Four buy amounts ({nativeSymbol})
          <Input value={presetDraft} onChange={e => setPresetDraft(e.target.value)} placeholder="0.01, 0.1, 1, 10" />
        </label>
        <p className="my-3 text-xs text-slate-500">Also saves the current slippage setting. Sell shortcuts use percentages of your recorded token holding.</p>
        {presetError && <p role="alert" className="mb-2 text-xs text-amber-400">{presetError}</p>}
        <Button onClick={savePreset}>Save preset</Button>
      </Modal>
      <Modal isOpen={calloutOpen} onClose={() => setCalloutOpen(false)} title="Make a callout" size="sm">
        <p className="mb-3 text-xs text-slate-400">Draft only. Nothing is published automatically; Phivex has no callout feed connected.</p>
        <textarea aria-label="Callout draft" value={callout} onChange={e => setCallout(e.target.value)} rows={5} className="w-full rounded-md border border-sentinel-700 bg-sentinel-900 p-2 text-sm text-slate-200" />
        <Button className="mt-3" onClick={async () => { try { await navigator.clipboard.writeText(callout); setCopyStatus('Callout copied'); } catch { setCopyStatus('Copy unavailable. Select and copy the draft manually.'); } }}>Copy callout</Button>
        <p role="status" className="mt-2 text-xs text-slate-400">{copyStatus}</p>
      </Modal>

      {/* Frozen review: changing sidebar inputs cannot change an in-progress approval. */}
      {isPreviewOpen && <TransactionPreviewModal
        key={reviewQuote?.id}
        isOpen={true}
        onClose={() => { if (!['preparing', 'awaitingWallet', 'signing', 'submitting'].includes(execution.state)) setIsPreviewOpen(false); }}
        quote={reviewQuote}
        side={side}
        onConfirmExecute={handleConfirmTrade}
        executionState={execution.state}
        executionError={execution.error}
        isExecuting={['preparing', 'awaitingWallet', 'signing', 'submitting'].includes(execution.state)}
        mainnetSwap
        feeLamports={execution.feeLamports}
        txSignature={execution.receipt?.txSignature}
        pending={execution.pending}
        onCheckStatus={() => void execution.checkStatus()}
      />}

    </section>
  );
}
