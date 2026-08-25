'use client';

import React, { useState, useMemo, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  Star,
  Zap,
  Users,
  Shield,
  Lock,
  CheckCircle,
  ExternalLink,
  Twitter,
  Search,
  ChevronRight,
  TrendingUp,
  Flame,
  Info,
  AlertTriangle,
  Globe,
  Send,
  BarChart2,
} from 'lucide-react';
import { useAppState, useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { Decimal } from '@/lib/math/decimal';
import { formatCompactUsd, formatTokenPrice, formatCount as formatCountBase } from '@/lib/discovery/format';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { MetricValue } from '@/components/ui/metric-value';
import { toValueState } from '@/lib/ui/value-state';

interface TokenDiscoveryCardProps {
  token: DiscoveryToken;
  variant?: 'compact' | 'expanded';
  quickBuyPresets?: number[]; // In SOL or USD
  quickBuyMode?: 'sol' | 'usd';
  onQuickBuy?: (token: DiscoveryToken, amount: number) => void;
}

/**
 * Display formatters.
 *
 * These delegate to `lib/discovery/format.ts`, which is the single tested
 * implementation. Three near-identical copies had drifted across this file,
 * `token-discovery-card.tsx` and the feed views, and the copies disagreed:
 * this one rendered an unknown holder count as `1` (`if (!num) return '1'`),
 * so a token with no holder data showed one holder, and its subscript table
 * only covered zero-runs of 3–9, falling back to `_12_` outside that range.
 *
 * The `$` prefix stays here because that is a presentation choice of this card,
 * not of the number.
 */
export function formatCompactUSD(val: number | string | undefined): string {
  const out = formatCompactUsd(val);
  return out === '—' ? '—' : `$${out}`;
}

export function formatSmartPrice(val: number | string | undefined): string {
  const out = formatTokenPrice(val);
  return out === '—' ? '—' : `$${out}`;
}

export const formatCount = formatCountBase;

export const TokenDiscoveryCard = memo(function TokenDiscoveryCard({
  token,
  variant = 'compact',
  quickBuyPresets = [0.05, 0.1, 0.5, 1.0],
  quickBuyMode = 'sol',
  onQuickBuy,
}: TokenDiscoveryCardProps) {
  const router = useRouter();
  const { primaryWallet, connectedWallet } = useAppState();
  const { setQuickBuyOpen, setWalletModalOpen, addNotification, setSelectedToken, setActiveView } = useAppActions();
  const { isWatchlisted: checkWatchlisted, toggleWatchlist } = useWatchlist();

  const activeWallet = primaryWallet || connectedWallet;

  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const isWatchlisted = checkWatchlisted(token.mint);
  const priceDec = useMemo(() => new Decimal(token.priceUsd || '0'), [token.priceUsd]);
  const mcapDec = useMemo(() => new Decimal(token.marketCapUsd || '0'), [token.marketCapUsd]);

  const handleOpenTrade = () => {
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoURI,
      priceUsd: token.priceUsd,
      marketCapUsd: token.marketCapUsd,
      liquidityUsd: token.liquidityUsd,
      chain: token.chain || 'solana',
    });
    setActiveView('trade');
    router.push(`/trade/${token.chain || 'solana'}/${token.mint}`);
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const willWatchlist = !isWatchlisted;
    toggleWatchlist(token.mint, {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      priceUsd: formatSmartPrice(token.priceUsd),
      priceChange24h: priceChange,
      marketCapUsd: formatCompactUSD(token.marketCapUsd),
      liquidityUsd: formatCompactUSD(token.liquidityUsd),
      riskRating: (token.riskTier as any) || 'low',
      chain: token.chain || 'solana',
    });
    addNotification({
      title: willWatchlist ? 'Added to Watchlist' : 'Removed from Watchlist',
      message: `${token.name} ($${token.symbol}) was ${willWatchlist ? 'added to' : 'removed from'} your watchlist.`,
      type: 'system',
    });
  };

  const handleTriggerBuy = (e: React.MouseEvent, amount?: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeWallet) {
      setWalletModalOpen(true);
      addNotification({
        title: 'Connect Wallet',
        message: 'Please connect your Solana wallet to buy tokens.',
        type: 'system',
      });
      return;
    }

    if (onQuickBuy && amount) {
      onQuickBuy(token, amount);
      return;
    }
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: priceDec.formatUSD(4),
      mcap: mcapDec.formatUSD(0),
      customAmountSol: quickBuyMode === 'sol' ? amount : undefined,
    });
  };

  // Truncated mint display
  const shortMint = useMemo(() => {
    if (!token.mint) return '...pump';
    if (token.source === 'Pump.fun' || token.mint.toLowerCase().endsWith('pump')) {
      return `${token.mint.slice(0, 4)}...pump`;
    }
    return `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`;
  }, [token.mint, token.source]);

  // Derived metrics
  const isPumpFun = token.source === 'Pump.fun' || token.mint?.toLowerCase().endsWith('pump');
  const isMeteora = token.source === 'Meteora';
  const isRaydium = token.source === 'Raydium';

  const dexBadgeLetter = isPumpFun ? '💊' : isMeteora ? 'M' : isRaydium ? 'R' : 'O';
  const dexBadgeColor = isPumpFun
    ? 'bg-emerald-500 text-slate-950'
    : isMeteora
    ? 'bg-purple-500 text-white'
    : 'bg-sky-500 text-slate-950';

  const buyRatio = token.buyPressureRatio ?? null;
  const buyPct = buyRatio !== null ? Math.round(buyRatio * 100) : null;
  const sellPct = buyPct !== null ? 100 - buyPct : null;

  /**
   * Four states, not one dash.
   *
   * `T10: —` read as "checked, nothing to report" whether the value was zero,
   * still computing, or never obtainable. `auditPending` marks the case where
   * the row rendered ahead of its analysis — the ownership pipeline fills these
   * in behind the feed.
   */
  const top10State = toValueState(token.top10HoldingsPct ?? null, {
    isPending: token.auditPending === true,
  });
  const devState = toValueState(token.devHoldingsPct ?? null, {
    isPending: token.auditPending === true,
  });
  const top10 = token.top10HoldingsPct ?? null;
  const devHoldings = token.devHoldingsPct ?? null;
  const riskScore = token.riskScore ?? token.discoveryScore?.totalScore ?? null;
  const riskTier =
    token.riskTier ??
    (riskScore === null ? null : riskScore >= 80 ? 'low' : riskScore >= 50 ? 'medium' : 'high');

  const migrationPct = token.migrationProgress ?? null;
  const isMigrating = isPumpFun && migrationPct !== null && migrationPct > 0 && migrationPct < 100;

  const priceChange = token.priceChange15m || token.priceChange1h || token.priceChange24h || 0;
  const isPositive = priceChange >= 0;

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Trade ${token.symbol}`}
      onClick={handleOpenTrade}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpenTrade();
        }
      }}
      className="group relative bg-[#0b0e14]/95 hover:bg-[#111722] border border-slate-800/80 hover:border-sky-500/50 rounded-xl p-2.5 transition-all duration-150 flex flex-col justify-between gap-2 shadow-sm select-none hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
    >
      {/* 1. Header Row: Logo, Name, Ticker, Price & % Change */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        {/* Left: Avatar + Title & Meta */}
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {/* Avatar Thumbnail with DEX Badge */}
          <TokenAvatar
            src={token.logoURI}
            symbol={token.symbol}
            name={token.name}
            mint={token.mint}
            size="md"
            dexBadge={token.source}
          />

          {/* Identity Stack */}
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
            {/* Line 1: Name + Symbol + Open + Copy + Star */}
            <div className="flex items-center gap-1 min-w-0">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenTrade();
                }}
                className="font-bold text-slate-100 text-xs hover:text-sky-400 truncate max-w-[85px] shrink-0 font-sans flex items-center gap-0.5 cursor-pointer"
                title={token.name}
              >
                <span>{token.name}</span>
                <ChevronRight className="w-2.5 h-2.5 text-slate-500 group-hover:text-sky-400 shrink-0" />
              </div>
              <span className="text-2xs text-slate-400 truncate max-w-[55px]" title={token.symbol}>
                ${token.symbol}
              </span>
              {/* Copycat swarm. Ten near-identical launches inside one 30-row
                  response is the finding — collapsing them silently would throw
                  the signal away along with the noise. */}
              {(token.duplicateCount ?? 1) > 1 && (
                <span
                  className="shrink-0 px-1 py-px rounded bg-amber-950/60 border border-amber-900/60 text-2xs font-mono font-bold text-amber-400"
                  title={`${token.duplicateCount} launches with this name and symbol appeared together. The most liquid is shown.`}
                >
                  ×{token.duplicateCount}
                </span>
              )}
              <button
                onClick={handleCopyAddress}
                className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 shrink-0 ml-auto"
                title={copied ? 'Copied CA!' : 'Copy Contract Address (CA)'}
                aria-label="Copy contract address"
              >
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={handleToggleWatchlist}
                className={`transition-all p-1 rounded-md shrink-0 border ${
                  isWatchlisted
                    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border-transparent'
                }`}
                title={isWatchlisted ? 'In Watchlist (Click to remove)' : 'Add to Watchlist'}
                aria-label="Toggle Watchlist"
              >
                <Star className={`w-3.5 h-3.5 ${isWatchlisted ? 'fill-amber-400' : ''}`} />
              </button>
            </div>

            {/* Line 2: Age | Truncated Mint | Holders */}
            <div className="flex items-center gap-1.5 text-2xs text-slate-400 leading-tight">
              <span className="font-medium text-slate-400">{token.ageFormatted || '1m'}</span>
              <span className="text-slate-700">|</span>
              <button
                onClick={handleCopyAddress}
                className="text-slate-400 hover:text-sky-300 transition-colors truncate font-mono text-2xs"
                title="Click to copy full address"
              >
                {shortMint}
              </button>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-0.5 text-sky-400" title="Total Holders">
                <Users className="w-2.5 h-2.5" />
                <span>{formatCount(token.holdersCount)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Price & % Change */}
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          <span className="font-bold text-slate-100 text-xs tracking-tight">
            {formatSmartPrice(token.priceUsd)}
          </span>
          <span
            className={`text-2xs font-bold px-1 py-0.2 rounded ${
              isPositive ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
            }`}
          >
            {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 2. Market & Activity Grid (MC, LIQ, VOL, TX, BUY/SELL) */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/60 text-2xs leading-tight">
        {/* Market Cap & Liquidity */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">MC</span>
            <span className="text-amber-400 font-bold">{formatCompactUSD(token.marketCapUsd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">LIQ</span>
            <span className="text-cyan-400 font-bold">{formatCompactUSD(token.liquidityUsd)}</span>
          </div>
        </div>

        {/* Volume & TX / Buy Pressure */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">VOL</span>
            <span className="text-slate-200 font-bold">{formatCompactUSD(token.volume24hUsd || token.volume1hUsd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">TX</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-300 font-medium">
                {formatCount(token.txCount1h || (token.buysCount + token.sellsCount))}
              </span>
              {/* Buy share of recent trades. Omitted entirely when there is no
                  pressure reading — "%B" with no number is worse than nothing. */}
              {buyPct !== null && (
                <span className="text-2xs text-emerald-400 font-bold" title={`${buyPct}% buys / ${sellPct}% sells`}>
                  {buyPct}%B
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Migration / Bonding Progress Bar (if applicable) */}
      {isMigrating && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-2xs text-slate-400 leading-none">
            <span className="flex items-center gap-0.5 text-amber-400 font-medium">
              <Flame className="w-2.5 h-2.5" /> Bonding Curve
            </span>
            <span className="font-bold text-slate-200">{migrationPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(2, migrationPct))}%` }}
            />
          </div>
        </div>
      )}

      {/* 4. Safety & Distribution Micro-Badges Bar */}
      <div className="flex items-center justify-between gap-1 text-2xs leading-none pt-0.5">
        {/* Top 10 Concentration. Neutral styling when unmeasured — a grey "—"
            reads as "not known", where a green badge would read as "safe". */}
        <div
          className={`flex items-center gap-0.5 px-1 py-0.5 rounded border ${
            top10State.kind !== 'value'
              ? 'bg-slate-900/80 border-slate-800 text-slate-500'
              : top10State.value > 60
              ? 'bg-rose-950/40 border-rose-900/50 text-rose-400'
              : top10State.value > 30
              ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
              : 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400'
          }`}
        >
          <span className="text-2xs text-slate-500">T10:</span>
          <MetricValue
            state={top10State}
            label="Top 10 holder concentration"
            format={(v) => `${v.toFixed(v < 10 ? 1 : 0)}%`}
          />
        </div>

        {/* Dev Holdings */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-300">
          <span className="text-2xs text-slate-500">DEV:</span>
          <MetricValue
            state={devState}
            label="Developer holdings"
            format={(v) => `${v.toFixed(v < 10 ? 1 : 0)}%`}
            colorize={() => 'text-cyan-400'}
          />
        </div>

        {/* Safety Score. An unscored token is explicitly unscored, never "low risk". */}
        <div
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border font-semibold ${
            riskTier === null
              ? 'bg-slate-900/80 border-slate-800 text-slate-500'
              : riskTier === 'low'
              ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400'
              : riskTier === 'medium'
              ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
              : 'bg-rose-950/40 border-rose-900/50 text-rose-400'
          }`}
        >
          <Shield className="w-2.5 h-2.5" />
          <MetricValue
            state={toValueState(riskScore, { isPending: token.auditPending === true })}
            label="Safety score"
            format={(v) => `${v}`}
          />
        </div>

        {/* AI Signal Badge */}
        {token.aiSignalScore !== undefined && (
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-950/50 border border-sky-800/50 text-sky-400 font-bold ml-auto"
            title={`AI Signal: ${token.aiSignalLabel || 'Bullish'} (${token.aiSignalReason || 'Signal active'})`}
          >
            <Zap className="w-2.5 h-2.5 text-sky-400 fill-current" />
            <span>{token.aiSignalScore}</span>
          </div>
        )}
      </div>

      {/* 5. Quick Buy Action Bar (Requirement 15 & 16) */}
      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
        {/* Social, DEX & Explorer Links */}
        <div className="flex items-center gap-1 text-slate-500 shrink-0">
          <button
            onClick={handleCopyAddress}
            className="px-1 py-0.5 rounded hover:bg-slate-800 text-2xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy Contract Address (CA)"
          >
            CA
          </button>

          {/* Twitter / X */}
          <Link
            href={token.twitterUrl || `https://x.com/search?q=${encodeURIComponent(token.symbol)}`}
            target="_blank"
            rel="noreferrer"
            className="p-1 hover:text-sky-400 text-slate-400 transition-colors"
            title={token.twitterUrl ? 'Official Twitter/X' : 'Search on Twitter/X'}
            onClick={(e) => e.stopPropagation()}
          >
            <Twitter className="w-2.5 h-2.5" />
          </Link>

          {/* Telegram */}
          {token.telegramUrl && (
            <Link
              href={token.telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 hover:text-sky-400 text-slate-400 transition-colors"
              title="Official Telegram Channel"
              onClick={(e) => e.stopPropagation()}
            >
              <Send className="w-2.5 h-2.5" />
            </Link>
          )}

          {/* Official Website */}
          {token.websiteUrl && (
            <Link
              href={token.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
              title="Official Project Website"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="w-2.5 h-2.5" />
            </Link>
          )}

          {/* DexScreener */}
          <Link
            href={`https://dexscreener.com/solana/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
            title="View Live Chart on DexScreener"
            onClick={(e) => e.stopPropagation()}
          >
            <BarChart2 className="w-2.5 h-2.5" />
          </Link>

          {/* Pump.fun Link if applicable */}
          {isPumpFun && (
            <Link
              href={`https://pump.fun/coin/${token.mint}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 hover:text-emerald-400 text-slate-400 transition-colors font-bold text-2xs leading-none"
              title="View on Pump.fun"
              onClick={(e) => e.stopPropagation()}
            >
              💊
            </Link>
          )}

          {/* Solscan Explorer */}
          <Link
            href={`https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            className="p-1 hover:text-slate-300 transition-colors"
            title="Solscan Explorer"
            onClick={(e) => e.stopPropagation()}
          >
            <Search className="w-2.5 h-2.5" />
          </Link>
        </div>

        {/* Quick Buy Preset Pills */}
        <div className="flex items-center gap-1 ml-auto">
          {quickBuyPresets.slice(0, 3).map((amt) => (
            <button
              key={amt}
              onClick={(e) => handleTriggerBuy(e, amt)}
              className="h-5 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-2xs font-bold text-slate-300 hover:text-white transition-colors"
              title={`Quick Buy with ${quickBuyMode === 'sol' ? `${amt} SOL` : `$${amt}`}`}
            >
              {quickBuyMode === 'sol' ? `≡${amt}` : `$${amt}`}
            </button>
          ))}

          {/* Master Quick Buy Button */}
          <button
            onClick={(e) => handleTriggerBuy(e)}
            className="h-5 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 hover:border-emerald-400 text-2xs font-bold flex items-center gap-0.5 transition-all shadow-sm"
            title="Open Instant Swap Execution"
          >
            <Zap className="w-2.5 h-2.5 fill-current" />
            <span>BUY</span>
          </button>
        </div>
      </div>
    </div>
  );
});
