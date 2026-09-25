'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Copy,
  Star,
  Globe,
  Users,
  Search,
  Shield,
  Eye,
  EyeOff,
  Layers,
  Share2,
  RotateCcw,
  Droplet,
  Crown,
} from 'lucide-react';
import { SkeletonChart } from '@/components/ui/skeleton-states';
import { useAppState, useAppActions, useWatchlist } from '@/lib/store';
import { useMarketSummary } from '@/lib/hooks/use-market-summary';
import { useSentinelWS } from '@/lib/hooks/use-sentinel-ws';
import { useLiveTokenUpdates } from '@/lib/hooks/use-live-token-updates';
import { LimitOrderBuilder } from '@/components/limit-orders/limit-order-builder';
import { AxiomChartTabs } from '@/components/trading/axiom-chart-tabs';
import { TradingPanel } from '@/components/trading/trading-panel';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { formatTokenPrice, formatCompactUsd, formatAge } from '@/lib/discovery/format';

// Lazy-load Candlestick Chart for code-splitting and fast initial render
const DynamicCandlestickChart = dynamic(() => import('@/components/trading/candlestick-chart'), {
  loading: () => <SkeletonChart />,
  ssr: false,
});

/** SOL icon for fees paid display */
function SolanaIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="none">
      <linearGradient id="sol-gr-a" x1="360.88" y1="351.46" x2="141.21" y2="-69.29" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 -25)">
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <path fill="url(#sol-gr-a)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
      <path fill="url(#sol-gr-a)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
      <path fill="url(#sol-gr-a)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
    </svg>
  );
}

/** DEX Platform Logo Component matching screenshot styling */
function PlatformLogo({ dexId, isPump, className = 'w-5 h-5' }: { dexId?: string; isPump?: boolean; className?: string }) {
  const d = (dexId || '').toLowerCase();
  if (d.includes('meteora') || d.includes('met-dbc')) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none">
        <path d="M12 6h8v3h-8zM9 9h14v3H9zM6 12h20v4H6zM3 16h26v5H3z" fill="url(#met-logo-g)" />
        <ellipse cx="16" cy="18" rx="14" ry="4.5" stroke="#FBBF24" strokeWidth="1.5" fill="none" />
        <defs>
          <linearGradient id="met-logo-g" x1="16" y1="6" x2="16" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (d.includes('pump') || isPump) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none">
        <g transform="translate(16 16) rotate(-45) translate(-16 -16)">
          <path d="M11 9h10a5 5 0 0 1 5 5v2H6v-2a5 5 0 0 1 5-5z" fill="#10B981" />
          <path d="M6 16h20v2a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5v-2z" fill="#E2E8F0" />
        </g>
      </svg>
    );
  }
  if (d.includes('raydium')) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none">
        <path d="M8 24L16 7l8 17h-4.5l-3.5-7.5-3.5 7.5H8z" fill="url(#ray-logo-g)" />
        <defs>
          <linearGradient id="ray-logo-g" x1="8" y1="7" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (d.includes('orca')) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none">
        <path d="M16 6c-5 0-9 4-9 9 0 3.8 2.3 7 5.7 8.3V19c-2-.9-3.4-2.8-3.4-5 0-3.1 2.5-5.6 5.7-5.6s5.7 2.5 5.7 5.6c0 2.2-1.4 4.1-3.4 5v4.3c3.4-1.3 5.7-4.5 5.7-8.3 0-5-4-9-9-9z" fill="#F59E0B" />
      </svg>
    );
  }
  // Default clean exchange icon
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      <path d="M16 5L4 27h24L16 5z" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="18" r="3.5" fill="#38BDF8" />
    </svg>
  );
}

/** Formatter for SOL fees paid, rendering subscript zeros when < 0.001 */
function formatSolFee(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  if (n >= 0.001) return n.toFixed(4);
  const exponent = Math.floor(Math.log10(n));
  const leadingZeros = Math.abs(exponent) - 1;
  const subscriptDigits = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
  const sub = String(leadingZeros).split('').map((d) => subscriptDigits[Number(d)] ?? d).join('');
  const significant = Math.round(n * Math.pow(10, Math.abs(exponent)));
  return `0.0${sub}${significant}`;
}

/** Compact market-cap progress bar */
function MCapBar({ value, className = '' }: { value?: number; className?: string }) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return <div className={`w-12 h-1 rounded-full bg-slate-800 ${className}`} />;
  }
  const minLog = 3; // $1K
  const maxLog = 9; // $1B
  const valLog = Math.max(minLog, Math.min(maxLog, Math.log10(value)));
  const pct = Math.round(((valLog - minLog) / (maxLog - minLog)) * 100);
  return (
    <div className={`w-12 h-1 rounded-full bg-slate-800 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all duration-700"
        style={{ width: `${Math.max(6, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

const dash = '—';

export interface TradeViewProps {
  tokenMint?: string;
  tokenSymbol?: string;
  chain?: string;
}

export function TradeView({
  tokenMint: propTokenMint,
  tokenSymbol: propTokenSymbol,
  chain: propChain,
}: TradeViewProps = {}) {
  const { connectedWallet, primaryWallet, selectedToken } = useAppState();
  const { addNotification } = useAppActions();
  const { isWatchlisted, toggleWatchlist } = useWatchlist();
  const { marketSummary } = useMarketSummary();

  const activeMint = propTokenMint || selectedToken?.mint || 'So11111111111111111111111111111111111111112';
  const activeSymbol = propTokenSymbol || selectedToken?.symbol || 'SOL';
  const activeChain = propChain || 'solana';

  const [tokenOverview, setTokenOverview] = useState<any>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Quick chart toggle states
  const [showChartTrades, setShowChartTrades] = useState(true);
  const [showChartOverlays, setShowChartOverlays] = useState(true);

  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [solAmount, setSolAmount] = useState('0.5');
  // Fresh Solana launches often have only one or two 15m bars. Open on 1m so
  // their real early price action is visible without inventing history.
  const [timeframe, setTimeframe] = useState('1m');
  const [showLimitBuilder, setShowLimitBuilder] = useState(false);

  // Live WebSocket streaming hook for real-time market metrics
  const activeMints = useMemo(() => (activeMint ? [activeMint] : []), [activeMint]);
  const live = useLiveTokenUpdates(activeMints);
  const liveUpdate = activeMint ? live.updates.get(activeMint) : undefined;

  // Direct Sentinel WebSocket listener for sub-second trade / price broadcast
  const wsTopics = useMemo(() => (activeMint ? [`token.price:${activeMint}`, `token.trade:${activeMint}`] : []), [activeMint]);
  useSentinelWS(wsTopics, (data, msg) => {
    if (msg.topic === `token.price:${activeMint}` && data?.priceUsd !== undefined) {
      setLivePrice(Number(data.priceUsd));
    }
  });

  // Fetch token details dynamically via REST
  useEffect(() => {
    let cancelled = false;
    async function loadToken() {
      if (!activeMint) return;
      try {
        const res = await fetch(`/api/v1/tokens/${activeChain}/${activeMint}`);
        if (res.ok) {
          const json = await res.json();
          const t = json.data?.token || json.token || json;
          if (!cancelled && t) {
            setTokenOverview(t);
          }
        }
      } catch {
        // Degrades gracefully to live streaming updates
      }
    }
    loadToken();
    return () => {
      cancelled = true;
    };
  }, [activeMint, activeChain]);

  const currentToken = useMemo(() => {
    const isNativeSol = activeMint === 'So11111111111111111111111111111111111111112';

    // Real Age derived from on-chain pairCreatedAt or discovery ageMinutes
    let ageMinutes: number | undefined;
    const pairCreatedAt = tokenOverview?.pairCreatedAt;
    if (typeof pairCreatedAt === 'number' && pairCreatedAt > 0) {
      ageMinutes = Math.max(0.05, (Date.now() - pairCreatedAt) / 60_000);
    } else if (tokenOverview?.ageMinutes !== undefined && tokenOverview.ageMinutes !== null) {
      ageMinutes = Number(tokenOverview.ageMinutes);
    }

    // Real Supply from on-chain/API data
    const rawSupply = tokenOverview?.totalSupply ?? tokenOverview?.circulatingSupply ?? tokenOverview?.supply;
    const supply = rawSupply !== undefined && rawSupply !== null ? Number(rawSupply) : undefined;

    // Real Fees Paid in SOL
    const rawFees = tokenOverview?.feesPaid ?? tokenOverview?.global_fees_paid ?? tokenOverview?.fees;
    const feesPaid = rawFees !== undefined && rawFees !== null && Number(rawFees) > 0 ? Number(rawFees) : undefined;

    // Real-time price: live websocket update > REST tokenOverview > selectedToken > SOL market fallback
    const rawPrice =
      livePrice ??
      liveUpdate?.priceUsd ??
      (tokenOverview?.priceUsd !== undefined ? Number(tokenOverview.priceUsd) : undefined) ??
      (tokenOverview?.price !== undefined ? Number(tokenOverview.price) : undefined) ??
      (selectedToken?.priceUsd !== undefined ? Number(selectedToken.priceUsd) : undefined) ??
      (isNativeSol ? marketSummary?.solPriceUsd : undefined);
    const priceUsd = typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined;

    // 24H Price Change
    const rawChange =
      liveUpdate?.priceChange24h ??
      tokenOverview?.priceChange24h ??
      tokenOverview?.priceChange24hPercent ??
      (isNativeSol ? marketSummary?.solChange24h : undefined);
    const priceChange24h = rawChange !== undefined && Number.isFinite(Number(rawChange)) ? Number(rawChange) : undefined;

    // Real-time Market Cap
    const rawMcap =
      (liveUpdate?.marketCapUsd !== undefined ? Number(liveUpdate.marketCapUsd) : undefined) ??
      (tokenOverview?.marketCapUsd !== undefined ? Number(tokenOverview.marketCapUsd) : undefined) ??
      (tokenOverview?.marketCap !== undefined ? Number(tokenOverview.marketCap) : undefined) ??
      (selectedToken?.marketCapUsd !== undefined ? Number(selectedToken.marketCapUsd) : undefined) ??
      (isNativeSol ? marketSummary?.totalMarketCapUsd : undefined);
    const marketCapUsd = typeof rawMcap === 'number' && Number.isFinite(rawMcap) && rawMcap > 0 ? rawMcap : undefined;

    // Real-time Liquidity
    const rawLiq =
      (liveUpdate?.liquidityUsd !== undefined ? Number(liveUpdate.liquidityUsd) : undefined) ??
      (tokenOverview?.liquidityUsd !== undefined ? Number(tokenOverview.liquidityUsd) : undefined) ??
      (tokenOverview?.liquidity !== undefined ? Number(tokenOverview.liquidity) : undefined) ??
      (selectedToken?.liquidityUsd !== undefined ? Number(selectedToken.liquidityUsd) : undefined) ??
      (isNativeSol ? marketSummary?.totalLiquidityUsd : undefined);
    const liquidityUsd = typeof rawLiq === 'number' && Number.isFinite(rawLiq) && rawLiq > 0 ? rawLiq : undefined;

    // Real-time 24H Volume
    const rawVol =
      (liveUpdate?.volume24hUsd !== undefined ? Number(liveUpdate.volume24hUsd) : undefined) ??
      (tokenOverview?.volume24hUsd !== undefined ? Number(tokenOverview.volume24hUsd) : undefined) ??
      (tokenOverview?.v24hUSD !== undefined ? Number(tokenOverview.v24hUSD) : undefined) ??
      (isNativeSol ? marketSummary?.totalVolume24hUsd : undefined);
    const volume24hUsd = typeof rawVol === 'number' && Number.isFinite(rawVol) && rawVol > 0 ? rawVol : undefined;

    // Platform & Graduation detection
    const isPump = Boolean(
      tokenOverview?.isPump ??
      (activeMint.toLowerCase().endsWith('pump') ||
        tokenOverview?.source?.toLowerCase()?.includes('pump') ||
        tokenOverview?.launchpad === 'pump.fun')
    );
    const hasGraduated = Boolean(
      tokenOverview?.hasGraduated ??
      (isPump && (tokenOverview?.dexId === 'raydium' || tokenOverview?.source?.toLowerCase()?.includes('migrated')))
    );
    const dexId = (tokenOverview?.dexId || (isPump ? 'pumpfun' : 'raydium')).toLowerCase();
    const isMeteora = dexId.includes('meteora') || tokenOverview?.source?.toLowerCase()?.includes('meteora');
    const platform = hasGraduated ? 'GP' : isPump ? 'PUMP' : (tokenOverview?.source || (isNativeSol ? 'Solana' : undefined));

    return {
      name: tokenOverview?.name || selectedToken?.name || (isNativeSol ? 'Wrapped SOL' : `Token ${activeMint.slice(0, 4)}`),
      symbol: tokenOverview?.symbol || selectedToken?.symbol || activeSymbol,
      mint: activeMint,
      logoUrl: tokenOverview?.logoUrl || tokenOverview?.logoURI || selectedToken?.logoUrl,
      priceUsd,
      priceChange24h,
      marketCapUsd,
      liquidityUsd,
      volume24hUsd,
      supply,
      feesPaid,
      ageMinutes,
      isPump,
      hasGraduated,
      isMeteora,
      dexId,
      dexUrl: tokenOverview?.dexUrl || tokenOverview?.dexscreenerUrl,
      platform,
      poolFeePct: tokenOverview?.poolFeePct ?? (isPump ? 1.0 : isMeteora ? 0.1 : 0.25),
      devHoldingPct: tokenOverview?.devHoldingPct,
      trendingRank: tokenOverview?.trendingRank,
      athPriceUsd: tokenOverview?.athPriceUsd,
      bondingCurveProgress: tokenOverview?.bondingCurveProgress,
      websiteUrl: tokenOverview?.websiteUrl || tokenOverview?.socials?.website,
      twitterUrl: tokenOverview?.twitterUrl || tokenOverview?.socials?.twitter,
      telegramUrl: tokenOverview?.telegramUrl || tokenOverview?.socials?.telegram,
      holderCount: liveUpdate?.holdersCount ?? tokenOverview?.holderCount ?? tokenOverview?.holder,
    };
  }, [tokenOverview, selectedToken, activeMint, activeSymbol, livePrice, liveUpdate, marketSummary]);

  const activeWallet = primaryWallet ?? connectedWallet ?? null;
  const activeBalance = activeWallet?.balanceSol ?? 0;
  const isBookmarked = activeMint ? isWatchlisted(activeMint) : false;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(activeMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setShared(true);
      addNotification({
        title: 'Link Copied',
        message: `Direct link for $${currentToken.symbol} copied to clipboard.`,
        type: 'system',
      });
      setTimeout(() => setShared(false), 2000);
    }
  };

  const handleToggleBookmark = () => {
    toggleWatchlist(activeMint, {
      mint: activeMint,
      name: currentToken.name,
      symbol: currentToken.symbol,
      chain: 'solana',
      priceUsd: currentToken.priceUsd !== undefined ? String(currentToken.priceUsd) : undefined,
      marketCapUsd: currentToken.marketCapUsd !== undefined ? `$${formatCompactUsd(currentToken.marketCapUsd)}` : undefined,
      liquidityUsd: currentToken.liquidityUsd !== undefined ? `$${formatCompactUsd(currentToken.liquidityUsd)}` : undefined,
    });
  };

  /** Format supply to compact string; returns dash when unknown */
  const fmtSupply = (n: number | undefined) => {
    if (n === undefined || !Number.isFinite(n) || n === 0) return dash;
    if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}T`;
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(Math.round(n));
  };

  return (
    <div className="terminal-trade space-y-2 sm:space-y-2.5 min-w-0">
      {/* ─────── Axiom Pro Real-Time Token Strip ─────── */}
      <div className="axiom-token-strip rounded-xl border border-sentinel-700/60 bg-gradient-to-r from-sentinel-900 via-sentinel-850 to-sentinel-900 px-3 py-2 sm:px-4 sm:py-2.5 shadow-card">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none overscroll-x-contain pb-0.5 pr-2">

          {/* 1. Leftmost DEX / Platform Icon Button */}
          <a
            href={currentToken.dexUrl || `https://dexscreener.com/solana/${currentToken.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-8 h-8 rounded-lg border border-slate-700/70 bg-slate-900/90 hover:bg-slate-800 hover:border-amber-500/50 transition-all flex items-center justify-center shadow-sm group"
            title={`Trading on ${currentToken.dexId?.toUpperCase() || 'DEX'} (Click to view pair)`}
          >
            <PlatformLogo dexId={currentToken.dexId} isPump={currentToken.isPump} className="w-5 h-5" />
          </a>

          {/* 2. Two Stacked Quick-Toggle Buttons */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowChartTrades((prev) => !prev)}
              className={`w-5 h-3.5 rounded flex items-center justify-center border transition-all ${
                showChartTrades
                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                  : 'border-slate-800/80 bg-slate-950/60 text-slate-600 hover:text-slate-400'
              }`}
              title={showChartTrades ? 'Hide Trades on Chart' : 'Show Trades on Chart'}
            >
              {showChartTrades ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowChartOverlays((prev) => !prev)}
              className={`w-5 h-3.5 rounded flex items-center justify-center border transition-all ${
                showChartOverlays
                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                  : 'border-slate-800/80 bg-slate-950/60 text-slate-600 hover:text-slate-400'
              }`}
              title={showChartOverlays ? 'Hide Chart Overlays & Indicators' : 'Show Chart Overlays & Indicators'}
            >
              {showChartOverlays ? <Layers className="h-2.5 w-2.5" /> : <Layers className="h-2.5 w-2.5 opacity-40" />}
            </button>
          </div>

          {/* 3. Token Avatar with Launchpad/Graduation Badge */}
          <div className="relative shrink-0">
            <TokenAvatar
              src={currentToken.logoUrl}
              symbol={currentToken.symbol}
              name={currentToken.name}
              mint={currentToken.mint}
              size="md"
            />
            {/* Corner Badge */}
            {currentToken.isMeteora ? (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/80 flex items-center justify-center text-[9px] shadow-sm" title="Meteora Pool">
                ☄️
              </span>
            ) : currentToken.isPump ? (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/80 flex items-center justify-center text-[9px] shadow-sm" title="Pump.fun Curve">
                💊
              </span>
            ) : currentToken.hasGraduated ? (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-emerald-300 flex items-center justify-center text-[9px] shadow-sm" title="Graduated">
                🎓
              </span>
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-sentinel-900 animate-pulse" />
            )}
          </div>

          {/* 4. Token Title, Fee Badge & Action Icons */}
          <div className="flex flex-col gap-0.5 shrink-0 min-w-0">
            {/* Row 1: Symbol, Name, Copy, Fee %, Share, Star */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-white tracking-tight">{currentToken.symbol}</span>
              <span className="text-xs text-slate-400 truncate max-w-[110px]" title={currentToken.name}>{currentToken.name}</span>
              <button
                onClick={handleCopyAddress}
                className="p-0.5 rounded hover:bg-slate-700/60 transition-colors group"
                title={copied ? 'Copied!' : `Copy: ${activeMint}`}
              >
                <Copy className={`h-3 w-3 ${copied ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'} transition-colors`} />
              </button>
              {/* Fee / Dev % Badge */}
              <span
                className="text-[11px] font-mono font-semibold text-slate-300 bg-slate-800/90 border border-slate-700/60 rounded px-1.5 py-px flex items-center gap-0.5"
                title={currentToken.devHoldingPct !== undefined ? `Dev Holding: ${currentToken.devHoldingPct}%` : `Pool Fee: ${currentToken.poolFeePct || 0.1}%`}
              >
                <span>%</span>
                <span>{currentToken.devHoldingPct !== undefined ? `${currentToken.devHoldingPct}%` : `${currentToken.poolFeePct || 0.1}%`}</span>
              </span>
              {/* Share Button */}
              <button
                onClick={handleShare}
                className="p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-white transition-colors"
                title={shared ? 'Link Copied!' : 'Share Token'}
              >
                <Share2 className={`h-3 w-3 ${shared ? 'text-emerald-400' : ''}`} />
              </button>
              {/* Watchlist Bookmark */}
              <button
                onClick={handleToggleBookmark}
                className="p-0.5 rounded hover:bg-slate-700/60 transition-colors"
                title={isBookmarked ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                <Star className={`h-3 w-3 transition-colors ${isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-slate-500 hover:text-amber-300'}`} />
              </button>
            </div>

            {/* Row 2: Age, Twitter/X, Explorer/Solscan */}
            <div className="flex items-center gap-2">
              {/* Age */}
              <span className="text-[11px] font-bold font-mono text-emerald-400" title={`Age: ${currentToken.ageMinutes?.toFixed(0) || '0'}m`}>
                {currentToken.ageMinutes !== undefined ? formatAge(currentToken.ageMinutes) : '—'}
              </span>
              {/* Twitter / X */}
              <a
                href={currentToken.twitterUrl || `https://x.com/search?q=${encodeURIComponent(currentToken.symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Twitter / X"
              >
                <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {/* Explorer / Solscan */}
              <a
                href={`https://solscan.io/token/${activeMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
                title="View on Solscan"
              >
                <Search className="h-3 w-3" />
              </a>
              {/* Optional Website */}
              {currentToken.websiteUrl && (
                <a
                  href={currentToken.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="Official Website"
                >
                  <Globe className="h-3 w-3" />
                </a>
              )}
              {/* Optional RugCheck */}
              <a
                href={`https://rugcheck.xyz/tokens/${activeMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-violet-400 transition-colors"
                title="RugCheck Audit"
              >
                <Shield className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/60 shrink-0 hidden sm:block" />

          {/* 5. Market Cap */}
          <div className="flex flex-col items-start gap-0.5 shrink-0">
            <span className="text-base font-extrabold text-white font-numeric tracking-tight">
              {currentToken.marketCapUsd !== undefined ? `$${formatCompactUsd(currentToken.marketCapUsd)}` : dash}
            </span>
            <MCapBar value={currentToken.marketCapUsd} />
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/40 shrink-0 hidden sm:block" />

          {/* 6. Price */}
          <div className="flex flex-col shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase leading-none">Price</span>
              {currentToken.priceChange24h !== undefined && (
                <span className={`text-[10px] font-bold font-numeric ${currentToken.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {currentToken.priceChange24h >= 0 ? '+' : ''}{currentToken.priceChange24h.toFixed(1)}%
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-white font-numeric">
              {currentToken.priceUsd !== undefined ? `$${formatTokenPrice(currentToken.priceUsd)}` : dash}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/40 shrink-0 hidden sm:block" />

          {/* 7. Liquidity with Water Drop Icon */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase leading-none">Liquidity</span>
            <span className="text-sm font-bold text-amber-400 font-numeric flex items-center gap-1">
              {currentToken.liquidityUsd !== undefined ? `$${formatCompactUsd(currentToken.liquidityUsd)}` : dash}
              <Droplet className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/40 shrink-0 hidden sm:block" />

          {/* 8. Supply with Circulating Arrow Icon */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase leading-none">Supply</span>
            <span className="text-sm font-bold text-white font-numeric flex items-center gap-1">
              {fmtSupply(currentToken.supply)}
              <RotateCcw className="h-3 w-3 text-slate-400 shrink-0" />
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/40 shrink-0 hidden sm:block" />

          {/* 9. Global Fees Paid with Solana Icon */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase leading-none">Global Fees Paid</span>
            <div className="flex items-center gap-1">
              <SolanaIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm font-bold text-white font-numeric">
                {currentToken.feesPaid !== undefined && currentToken.feesPaid > 0 ? formatSolFee(currentToken.feesPaid) : dash}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-700/40 shrink-0 hidden sm:block" />

          {/* 10. ATH */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] text-slate-400 font-mono uppercase leading-none">ATH</span>
            <span className="text-sm font-bold text-slate-300 font-numeric">
              {currentToken.athPriceUsd !== undefined ? `$${formatTokenPrice(currentToken.athPriceUsd)}` : dash}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-4 shrink-0" />

          {/* 11. Trending Rank / Crown (Far Right) */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold text-xs shrink-0 shadow-sm"
            title={currentToken.trendingRank ? `Trending Rank #${currentToken.trendingRank}` : 'Top Rank'}
          >
            <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20 shrink-0" />
            <span>{currentToken.trendingRank ?? 1}</span>
          </div>

        </div>
      </div>

      {/* Main Terminal Workspace Layout */}
      <div className="terminal-trade-grid">
        {/* Left 3 Cols: Chart + Intelligence Breakdown */}
        <div className="terminal-trade-chart min-w-0">
          {/* Candlestick Chart (Compact Embedded) */}
          <DynamicCandlestickChart
            compact={true}
            height="h-[420px] sm:h-[480px] lg:h-[500px]"
            timeframe={timeframe}
            symbol={currentToken.mint}
            tokenSymbol={currentToken.symbol}
            onTimeframeChange={setTimeframe}
          />
        </div>
        <div className="terminal-trade-details min-w-0 overflow-x-auto">
          {/* Axiom-Style Navigation Tabs (Trades, Positions, Orders, Sentinel Intelligence Audit, Holders, Top Traders, Dev Tokens) */}
          <AxiomChartTabs
            currentPrice={currentToken.priceUsd}
            tokenSymbol={currentToken.symbol}
            tokenMint={currentToken.mint}
            onOpenLimitBuilder={() => setShowLimitBuilder(true)}
            onQuickTrade={(type, amt) => {
              setOrderType(type);
              setSolAmount(amt.toString());
              addNotification({
                title: `Instant ${type.toUpperCase()} Selected`,
                message: `Set ${type.toUpperCase()} order size to ${amt} SOL on $${currentToken.symbol}.`,
                type: 'system',
              });
            }}
          />
        </div>

        {/* Right 1 Col: Execution Order Form Panel */}
        <div className="terminal-trade-order min-w-0">
          <TradingPanel
            tokenSymbol={currentToken.symbol}
            tokenMint={currentToken.mint}
            tokenPriceUsd={currentToken.priceUsd?.toString() || '0'}
            initialInputAmount={solAmount}
            initialSide={orderType}
          />
        </div>
      </div>

      {/* Intelligent Limit Order Builder Modal */}
      {showLimitBuilder && (
        <LimitOrderBuilder
          currentPrice={currentToken.priceUsd ?? 0}
          walletBalanceSol={activeBalance}
          walletAddress={activeWallet?.address ?? null}
          tokenMint={currentToken.mint}
          tokenSymbol={currentToken.symbol}
          onClose={() => setShowLimitBuilder(false)}
          onOrderCreated={() => {
            addNotification({
              title: 'Limit Order Created',
              message: 'Your persistent intelligent limit order is now active.',
              type: 'system',
            });
            setShowLimitBuilder(false);
          }}
        />
      )}
    </div>
  );
}
