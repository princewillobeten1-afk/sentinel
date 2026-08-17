'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Zap,
  ShieldCheck,
  ArrowRight,
  Settings2,
  Search,
  ClipboardPaste,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  XCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TokenSocials } from '@/components/ui/token-socials';
import { useAppState, useAppActions } from '@/lib/store';

/* ── Types ─────────────────────────────────────────────────── */

interface ResolvedToken {
  name: string;
  symbol: string;
  mint: string;
  price: string;
  priceUsd: number;
  mcap: string;
  liquidity: string;
  volume24h: string;
  priceChange24h: number;
  holders: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  imageColor: string;
  poolAddress: string;
}

/* ── Token Database (simulated resolution) ─────────────────── */

const TOKEN_DATABASE: Record<string, ResolvedToken> = {
  '7xK99zK8mP2xQ5wN3a19': {
    name: 'Solana Sentinel',
    symbol: '$SENT',
    mint: '7xK99zK8mP2xQ5wN3a19',
    price: '$0.042',
    priceUsd: 0.042,
    mcap: '$14.2M',
    liquidity: '$820K',
    volume24h: '$4.2M',
    priceChange24h: 34.2,
    holders: 8420,
    riskLevel: 'low',
    riskScore: 92,
    imageColor: 'sky',
    poolAddress: 'pool_7xK9...rayd',
  },
  '3mA1kZ9bP2qL5fW8nC4x': {
    name: 'Cyber Core AI',
    symbol: '$CYBER',
    mint: '3mA1kZ9bP2qL5fW8nC4x',
    price: '$0.185',
    priceUsd: 0.185,
    mcap: '$6.8M',
    liquidity: '$450K',
    volume24h: '$1.8M',
    priceChange24h: 18.7,
    holders: 3210,
    riskLevel: 'low',
    riskScore: 78,
    imageColor: 'violet',
    poolAddress: 'pool_3mA1...orca',
  },
  '9pW2mX4cQ7eL3kJ8bN1z': {
    name: 'Solana Meme',
    symbol: '$SOLM',
    mint: '9pW2mX4cQ7eL3kJ8bN1z',
    price: '$0.0084',
    priceUsd: 0.0084,
    mcap: '$840K',
    liquidity: '$120K',
    volume24h: '$340K',
    priceChange24h: -12.4,
    holders: 1280,
    riskLevel: 'high',
    riskScore: 32,
    imageColor: 'rose',
    poolAddress: 'pool_9pW2...pump',
  },
  '4bR7nY3fK1mW9pL6xQ8s': {
    name: 'DegenApes Token',
    symbol: '$DAPE',
    mint: '4bR7nY3fK1mW9pL6xQ8s',
    price: '$0.00012',
    priceUsd: 0.00012,
    mcap: '$48K',
    liquidity: '$12K',
    volume24h: '$85K',
    priceChange24h: 142.5,
    holders: 412,
    riskLevel: 'critical',
    riskScore: 15,
    imageColor: 'amber',
    poolAddress: 'pool_4bR7...pump',
  },
  '6jT5xP8cR2nK4mL9wQ3v': {
    name: 'Jupiter Protocol',
    symbol: '$JUP',
    mint: '6jT5xP8cR2nK4mL9wQ3v',
    price: '$1.24',
    priceUsd: 1.24,
    mcap: '$1.69B',
    liquidity: '$42M',
    volume24h: '$89M',
    priceChange24h: 5.3,
    holders: 284000,
    riskLevel: 'low',
    riskScore: 97,
    imageColor: 'emerald',
    poolAddress: 'pool_6jT5...rayd',
  },
};

/** Simulate resolving a contract address to token data */
function resolveContractAddress(address: string): Promise<ResolvedToken | null> {
  return new Promise((resolve) => {
    const delay = 600 + Math.random() * 800;
    setTimeout(() => {
      // Check exact matches
      if (TOKEN_DATABASE[address]) {
        resolve(TOKEN_DATABASE[address]);
        return;
      }
      // For any valid-looking Solana address, generate random token
      if (/^[1-9A-HJ-NP-Za-km-z]{20,50}$/.test(address)) {
        const randomNames = [
          { name: 'Phantom Rush', symbol: '$RUSH', color: 'cyan' },
          { name: 'Nova Finance', symbol: '$NOVA', color: 'indigo' },
          { name: 'Moon Degen', symbol: '$MOODG', color: 'pink' },
          { name: 'Solana Whale', symbol: '$SWHALE', color: 'teal' },
          { name: 'Alpha Sniper', symbol: '$ASNPR', color: 'orange' },
        ];
        const pick = randomNames[Math.floor(Math.random() * randomNames.length)];
        const priceUsd = parseFloat((Math.random() * 0.5).toFixed(6));
        const riskRoll = Math.random();
        const riskLevel = riskRoll > 0.7 ? 'low' : riskRoll > 0.4 ? 'medium' : riskRoll > 0.15 ? 'high' : 'critical';
        const riskScoreMap = { low: 80 + Math.floor(Math.random() * 18), medium: 50 + Math.floor(Math.random() * 25), high: 20 + Math.floor(Math.random() * 25), critical: Math.floor(Math.random() * 20) };
        resolve({
          name: pick.name,
          symbol: pick.symbol,
          mint: address,
          price: `$${priceUsd.toFixed(priceUsd < 0.001 ? 6 : 4)}`,
          priceUsd,
          mcap: `$${(Math.random() * 50).toFixed(1)}M`,
          liquidity: `$${(Math.random() * 500 + 20).toFixed(0)}K`,
          volume24h: `$${(Math.random() * 2000 + 50).toFixed(0)}K`,
          priceChange24h: parseFloat(((Math.random() - 0.3) * 100).toFixed(1)),
          holders: Math.floor(Math.random() * 10000 + 100),
          riskLevel,
          riskScore: riskScoreMap[riskLevel],
          imageColor: pick.color,
          poolAddress: `pool_${address.slice(0, 4)}...rayd`,
        });
        return;
      }
      resolve(null);
    }, delay);
  });
}

/* ── Component ─────────────────────────────────────────────── */

export function QuickBuyDrawer() {
  const { isQuickBuyOpen, quickBuyToken, connectedWallet } = useAppState();
  const { setQuickBuyOpen, addNotification, addExecutionLog } = useAppActions();

  /* ── Contract Address Resolution ── */
  const [contractInput, setContractInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<ResolvedToken | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [copiedMint, setCopiedMint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Trading Configuration ── */
  const [solAmount, setSolAmount] = useState('0.5');
  const [slippage, setSlippage] = useState('1.0');
  const [priorityFee, setPriorityFee] = useState('Turbo');
  const [mevProtection, setMevProtection] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const presets = ['0.1', '0.5', '1.0', '5.0'];
  const balance = connectedWallet?.balanceSol ?? 42.85;

  // If the drawer receives a quickBuyToken from outside, use it
  useEffect(() => {
    if (quickBuyToken && isQuickBuyOpen) {
      setResolvedToken({
        name: quickBuyToken.name,
        symbol: quickBuyToken.symbol,
        mint: quickBuyToken.mint,
        price: quickBuyToken.price,
        priceUsd: parseFloat(quickBuyToken.price.replace('$', '')) || 0.042,
        mcap: quickBuyToken.mcap,
        liquidity: '$820K',
        volume24h: '$4.2M',
        priceChange24h: 34.2,
        holders: 8420,
        riskLevel: 'low',
        riskScore: 92,
        imageColor: 'sky',
        poolAddress: `pool_${quickBuyToken.mint.slice(0, 4)}...rayd`,
      });
      setContractInput(quickBuyToken.mint);
      setResolveError(null);
    }
  }, [quickBuyToken, isQuickBuyOpen]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!isQuickBuyOpen) {
      setTimeout(() => {
        setContractInput('');
        setResolvedToken(null);
        setResolveError(null);
        setIsResolving(false);
        setSolAmount('0.5');
        setCopiedMint(false);
      }, 300);
    }
  }, [isQuickBuyOpen]);

  // Focus on input when drawer opens
  useEffect(() => {
    if (isQuickBuyOpen && !quickBuyToken) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isQuickBuyOpen, quickBuyToken]);

  /* ── Resolve contract address ── */
  const handleResolve = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setIsResolving(true);
    setResolveError(null);
    setResolvedToken(null);

    addExecutionLog({
      text: `[TOKEN-RESOLVE] Looking up contract: ${trimmed.slice(0, 12)}...`,
      level: 'info',
    });

    try {
      const result = await resolveContractAddress(trimmed);
      if (result) {
        setResolvedToken(result);
        addExecutionLog({
          text: `[TOKEN-RESOLVE] Found: ${result.name} (${result.symbol}) — Risk: ${result.riskLevel.toUpperCase()}`,
          level: 'success',
        });
      } else {
        setResolveError('Invalid contract address. Please check and try again.');
        addExecutionLog({
          text: `[TOKEN-RESOLVE] Failed: No token found for address ${trimmed.slice(0, 16)}...`,
          level: 'error',
        });
      }
    } catch {
      setResolveError('Network error resolving contract. Please try again.');
    } finally {
      setIsResolving(false);
    }
  }, [addExecutionLog]);

  /* ── Paste from clipboard ── */
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setContractInput(text.trim());
        handleResolve(text.trim());
      }
    } catch {
      // Clipboard API not available, show input focus
      inputRef.current?.focus();
    }
  }, [handleResolve]);

  /* ── Copy mint address ── */
  const handleCopyMint = useCallback(() => {
    if (resolvedToken) {
      navigator.clipboard.writeText(resolvedToken.mint).catch(() => {});
      setCopiedMint(true);
      setTimeout(() => setCopiedMint(false), 2000);
    }
  }, [resolvedToken]);

  /* ── Handle key press in input ── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleResolve(contractInput);
    }
  }, [contractInput, handleResolve]);

  /* ── Estimate output ── */
  const solVal = parseFloat(solAmount) || 0;
  const estimatedTokens = resolvedToken ? (solVal * 170) / (resolvedToken.priceUsd || 0.042) : 0;
  const priceImpact = solVal < 1 ? 0.04 : solVal < 5 ? 0.12 : 0.38;
  const networkFee = 0.00005;

  /* ── Risk colors ── */
  const riskConfig = {
    low: { label: 'LOW RISK', variant: 'risk-low' as const, color: 'emerald' },
    medium: { label: 'MEDIUM', variant: 'risk-med' as const, color: 'amber' },
    high: { label: 'HIGH RISK', variant: 'risk-high' as const, color: 'orange' },
    critical: { label: 'CRITICAL', variant: 'risk-critical' as const, color: 'rose' },
  };

  /* ── Execute order ── */
  const handleExecuteOrder = () => {
    if (!resolvedToken) return;
    setIsExecuting(true);

    addExecutionLog({
      text: `[EXECUTION-ENGINE] Initiating Quick Trade: ${solAmount} SOL → ${resolvedToken.symbol} (Contract: ${resolvedToken.mint.slice(0, 12)}...)`,
      level: 'info',
    });

    addExecutionLog({
      text: `[ROUTE-OPTIMIZER] Finding best route via Sentinel Aggregator (Slippage: ${slippage}%, Fee: ${priorityFee}, MEV: ${mevProtection ? 'ON' : 'OFF'})`,
      level: 'info',
    });

    setTimeout(() => {
      addExecutionLog({
        text: `[EXECUTION-ENGINE] Transaction signed. Broadcasting to Solana mainnet...`,
        level: 'info',
      });
    }, 400);

    setTimeout(() => {
      setIsExecuting(false);
      setQuickBuyOpen(false);

      addNotification({
        title: 'Quick Trade Executed',
        message: `Successfully bought ~${estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${resolvedToken.symbol} for ${solAmount} SOL (Slippage: ${slippage}%, ${priorityFee})`,
        type: 'execution',
      });

      addExecutionLog({
        text: `[EXECUTION-ENGINE] ✓ CONFIRMED: Tx hash 4zW8...9kL2 on Solana Mainnet — ${estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${resolvedToken.symbol} acquired`,
        level: 'success',
      });
    }, 1200);
  };

  /* ── Token image placeholder color ── */
  const colorMap: Record<string, string> = {
    sky: 'text-sky-400', emerald: 'text-emerald-400', violet: 'text-violet-400',
    rose: 'text-rose-400', amber: 'text-amber-400', cyan: 'text-cyan-400',
    indigo: 'text-indigo-400', pink: 'text-pink-400', teal: 'text-teal-400',
    orange: 'text-orange-400',
  };

  const risk = resolvedToken ? riskConfig[resolvedToken.riskLevel] : null;

  return (
    <Drawer
      isOpen={isQuickBuyOpen}
      onClose={() => setQuickBuyOpen(false)}
      title={
        <span className="flex items-center gap-2 text-emerald-400">
          <Zap className="h-5 w-5 fill-current" /> Instant Quick Trade Terminal
        </span>
      }
      subtitle="Paste a contract address — buy in one click"
      position="right"
      footer={
        resolvedToken ? (
          <div className="space-y-3">
            {resolvedToken.riskLevel === 'critical' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-rose-500/30 bg-rose-950/40 text-2xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>CRITICAL RISK:</strong> This token has a very low safety score ({resolvedToken.riskScore}/100).
                  Proceed with extreme caution.
                </span>
              </div>
            )}
            <Button
              onClick={handleExecuteOrder}
              variant="buy"
              size="lg"
              isLoading={isExecuting}
              disabled={!solVal || solVal > balance}
              className="w-full text-base py-3 shadow-glow-buy"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Execute Market Buy ({solAmount} SOL)
            </Button>
            <p className="text-2xs text-center text-slate-500 font-mono">
              Hotkey: Shift + B | Press ESC to cancel
            </p>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* ═══ CONTRACT ADDRESS INPUT ═══ */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-sky-400" />
            Contract Address
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={contractInput}
              onChange={(e) => setContractInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste Solana token address..."
              className="w-full bg-sentinel-950 border border-sentinel-700 rounded-xl px-4 py-3 pr-24 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/60 transition-all"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 text-2xs font-semibold transition-colors border border-sky-500/20"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="h-3 w-3" />
                Paste
              </button>
            </div>
          </div>

          {/* Search / Resolve Button */}
          {contractInput && !resolvedToken && !isResolving && (
            <button
              onClick={() => handleResolve(contractInput)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-colors border border-sky-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Resolve Token & Analyze
            </button>
          )}
        </div>

        {/* ═══ RESOLVING STATE ═══ */}
        {isResolving && (
          <div className="rounded-xl border border-sentinel-700 bg-sentinel-850 p-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-sky-500/30 animate-pulse" />
              <Loader2 className="h-6 w-6 text-sky-400 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-200">Resolving Token...</p>
              <p className="text-2xs text-slate-500 font-mono">
                Querying on-chain metadata & DEX pools
              </p>
            </div>
            <div className="w-full max-w-[200px] h-1 rounded-full bg-sentinel-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* ═══ ERROR STATE ═══ */}
        {resolveError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-300">Token Not Found</p>
              <p className="text-xs text-rose-400/80 mt-0.5">{resolveError}</p>
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {!resolvedToken && !isResolving && !resolveError && !contractInput && (
          <div className="rounded-xl border border-sentinel-700/50 border-dashed bg-sentinel-950/50 p-8 flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border border-sentinel-700 flex items-center justify-center">
                <Zap className="h-7 w-7 text-sky-400/60" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-emerald-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-slate-200">Paste to Snipe</p>
              <p className="text-2xs text-slate-500 max-w-[240px] leading-relaxed">
                Paste any Solana contract address above to instantly resolve the token, analyze risk, and execute a market buy — all in one flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {Object.entries(TOKEN_DATABASE).slice(0, 3).map(([mint, tk]) => (
                <button
                  key={mint}
                  onClick={() => {
                    setContractInput(mint);
                    handleResolve(mint);
                  }}
                  className="px-2 py-1 rounded-lg bg-sentinel-850 border border-sentinel-700 text-2xs font-mono text-slate-400 hover:text-sky-300 hover:border-sky-500/40 transition-all"
                >
                  {tk.symbol}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ RESOLVED TOKEN INFO ═══ */}
        {resolvedToken && !isResolving && (
          <>
            {/* Token Header Banner */}
            <div className="rounded-xl border border-sentinel-700 bg-sentinel-850 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-750 font-bold text-sm border border-sentinel-600 ${colorMap[resolvedToken.imageColor] || 'text-sky-400'}`}>
                    {resolvedToken.symbol.replace('$', '').slice(0, 3)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 text-base">{resolvedToken.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 font-mono">{resolvedToken.symbol}</span>
                      <TokenSocials symbol={resolvedToken.symbol} showHandles={false} size="xs" />
                    </div>
                  </div>
                </div>
                <div className="text-right font-numeric">
                  <p className="text-sm font-bold text-white">{resolvedToken.price}</p>
                  <p className="text-2xs text-slate-400">MCap {resolvedToken.mcap}</p>
                </div>
              </div>

              {/* Token stats row */}
              <div className="mt-3 pt-2.5 border-t border-sentinel-700/60 grid grid-cols-3 gap-2 text-2xs">
                <div>
                  <span className="text-slate-500 block">Liquidity</span>
                  <span className="text-slate-200 font-bold font-mono">{resolvedToken.liquidity}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">24h Vol</span>
                  <span className="text-slate-200 font-bold font-mono">{resolvedToken.volume24h}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Holders</span>
                  <span className="text-slate-200 font-bold font-mono">{resolvedToken.holders.toLocaleString()}</span>
                </div>
              </div>

              {/* Mint + Risk */}
              <div className="mt-2.5 pt-2 border-t border-sentinel-700/40 flex items-center justify-between text-2xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  Mint: {resolvedToken.mint.slice(0, 8)}...{resolvedToken.mint.slice(-6)}
                  <button onClick={handleCopyMint} className="hover:text-white transition-colors" title="Copy mint address">
                    {copiedMint ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <a href="#" className="hover:text-white transition-colors" title="View on Solscan">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </span>
                {risk && <Badge variant={risk.variant} size="sm">{risk.label}</Badge>}
              </div>

              {/* Risk Score Bar */}
              {risk && (
                <div className="mt-2.5 pt-2 border-t border-sentinel-700/40">
                  <div className="flex items-center justify-between text-2xs mb-1">
                    <span className="text-slate-500">Sentinel Safety Score</span>
                    <span className={`font-bold font-mono ${
                      resolvedToken.riskScore >= 70 ? 'text-emerald-400' :
                      resolvedToken.riskScore >= 40 ? 'text-amber-400' :
                      'text-rose-400'
                    }`}>
                      {resolvedToken.riskScore}/100
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-sentinel-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        resolvedToken.riskScore >= 70
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : resolvedToken.riskScore >= 40
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-rose-500 to-rose-400'
                      }`}
                      style={{ width: `${resolvedToken.riskScore}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ═══ BUY AMOUNT SELECTOR ═══ */}
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-300">Buy Amount (SOL)</label>
                <span className="font-numeric text-slate-400">
                  Balance: <span className="text-slate-200 font-bold">{balance} SOL</span>
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {presets.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSolAmount(amt)}
                    className={`py-2 rounded-lg font-numeric font-bold text-xs transition border ${
                      solAmount === amt
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60'
                        : 'bg-sentinel-950 text-slate-300 border-sentinel-700 hover:border-sentinel-600'
                    }`}
                  >
                    {amt} SOL
                  </button>
                ))}
              </div>

              <Input
                isMonospace
                type="number"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                placeholder="Custom SOL Amount"
                rightAddon={<span className="text-xs font-mono text-slate-400">SOL</span>}
              />

              {solVal > balance && (
                <p className="text-2xs text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Insufficient balance
                </p>
              )}
            </div>

            {/* ═══ ROUTE & PROTECTION CONFIG ═══ */}
            <div className="rounded-xl border border-sentinel-700/80 bg-sentinel-950/60 p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200 border-b border-sentinel-800 pb-2">
                <span className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5 text-sky-400" /> Route & Protection Config
                </span>
                <span className="text-2xs font-mono text-sky-400">OPTIMIZED</span>
              </div>

              {/* Slippage */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Slippage Tolerance</span>
                  <span className="font-mono text-slate-200 font-bold">{slippage}%</span>
                </div>
                <div className="flex gap-2">
                  {['0.5', '1.0', '3.0'].map((slip) => (
                    <button
                      key={slip}
                      onClick={() => setSlippage(slip)}
                      className={`flex-1 py-1 rounded text-xs font-mono transition border ${
                        slippage === slip
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                          : 'bg-sentinel-900 text-slate-400 border-sentinel-800 hover:text-slate-200'
                      }`}
                    >
                      {slip}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Fee */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Priority Fee Speed</span>
                  <span className="font-mono text-slate-200 font-bold">{priorityFee}</span>
                </div>
                <div className="flex gap-2">
                  {['Fast', 'Turbo', 'Ultra'].map((fee) => (
                    <button
                      key={fee}
                      onClick={() => setPriorityFee(fee)}
                      className={`flex-1 py-1 rounded text-xs font-mono transition border ${
                        priorityFee === fee
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-sentinel-900 text-slate-400 border-sentinel-800 hover:text-slate-200'
                      }`}
                    >
                      {fee}
                    </button>
                  ))}
                </div>
              </div>

              {/* MEV Protection */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Private MEV Protection
                </span>
                <button
                  onClick={() => setMevProtection(!mevProtection)}
                  className={`w-10 h-5 rounded-full transition-colors p-0.5 ${
                    mevProtection ? 'bg-emerald-500' : 'bg-sentinel-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                      mevProtection ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* ═══ PRE-TRADE SIMULATION ═══ */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950 p-3 text-xs space-y-1.5 font-numeric text-slate-300 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Tokens:</span>
                <span className="font-bold text-white">
                  ~{estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} {resolvedToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Price Impact:</span>
                <span className={`font-bold ${priceImpact < 0.2 ? 'text-emerald-400' : priceImpact < 1 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Network Fee:</span>
                <span>{networkFee} SOL ($0.007)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Route:</span>
                <span className="text-sky-400 font-bold">Sentinel Aggregator</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
