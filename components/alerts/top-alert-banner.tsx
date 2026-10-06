'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  ExternalLink,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  BarChart2,
  Sparkles,
  Flame,
  ShieldAlert,
  Crown,
  History,
  Coins,
  Brain,
  Copy,
  Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useLiveAlerts } from '@/lib/hooks/use-live-alerts';
import { useAppActions } from '@/lib/store';
import type { LiveTradeAlert, LiveAlertType } from '@/lib/alerts/live-alert-types';

const DISMISS_DURATION_MS = 7000;

export function TopAlertBanner() {
  const router = useRouter();
  const {
    activeAlert,
    dismissActiveAlert,
    soundEnabled,
    toggleSound,
    setHistoryDrawerOpen,
    unreadCount,
    isPaused,
  } = useLiveAlerts();

  const { setQuickBuyOpen, setSelectedToken } = useAppActions();

  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedBeforePauseRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Auto-dismiss countdown with hover pause
  useEffect(() => {
    if (!activeAlert || isPaused) {
      setProgress(100);
      return;
    }

    startTimeRef.current = Date.now();
    elapsedBeforePauseRef.current = 0;
    setProgress(100);

    const updateTimer = () => {
      if (isHovered) {
        // Paused on hover
        animFrameRef.current = requestAnimationFrame(updateTimer);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current + elapsedBeforePauseRef.current;
      const remainingPct = Math.max(0, 100 - (elapsed / DISMISS_DURATION_MS) * 100);
      setProgress(remainingPct);

      if (remainingPct <= 0) {
        dismissActiveAlert();
      } else {
        animFrameRef.current = requestAnimationFrame(updateTimer);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeAlert, isPaused, isHovered, dismissActiveAlert]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setIsHovered(false);
  };

  if (!activeAlert || isPaused) return null;

  const {
    type,
    headline,
    message,
    token,
    caller,
    trade,
    milestone,
    risk,
    quickBuyDefaultSol = 0.5,
    sourceUrl,
  } = activeAlert;

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickBuyOpen(true, {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      price: String(token.priceUsd),
      mcap: String(token.marketCapUsd),
      customAmountSol: quickBuyDefaultSol,
      liquidity: token.liquidityUsd ? String(token.liquidityUsd) : undefined,
      logoURI: token.avatarUrl,
    });
    dismissActiveAlert();
  };

  const handleOpenChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      priceUsd: String(token.priceUsd),
      marketCapUsd: String(token.marketCapUsd),
      logoUrl: token.avatarUrl,
      chain: 'solana',
    });
    router.push(`/trade?token=${encodeURIComponent(token.mint)}`);
    dismissActiveAlert();
  };

  const getCategoryTheme = (t: LiveAlertType) => {
    switch (t) {
      case 'CALL':
        return {
          glow: 'shadow-[0_4px_30px_rgba(6,182,212,0.22)]',
          border: 'border-cyan-500/40 hover:border-cyan-400/70',
          badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          barBg: 'bg-gradient-to-r from-cyan-500 to-sky-400',
          icon: Sparkles,
          label: 'ALPHA CALL',
        };
      case 'WHALE_TRADE':
        return {
          glow: 'shadow-[0_4px_30px_rgba(168,85,247,0.22)]',
          border: 'border-purple-500/40 hover:border-purple-400/70',
          badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          barBg: 'bg-gradient-to-r from-purple-500 to-indigo-400',
          icon: Coins,
          label: 'WHALE BUY',
        };
      case 'SMART_MONEY':
        return {
          glow: 'shadow-[0_4px_30px_rgba(16,185,129,0.22)]',
          border: 'border-emerald-500/40 hover:border-emerald-400/70',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          barBg: 'bg-gradient-to-r from-emerald-500 to-teal-400',
          icon: Brain,
          label: 'SMART MONEY',
        };
      case 'INSIDER_ACTIVITY':
        return {
          glow: 'shadow-[0_4px_30px_rgba(245,158,11,0.22)]',
          border: 'border-amber-500/40 hover:border-amber-400/70',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          barBg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
          icon: Brain,
          label: 'POTENTIAL INSIDER',
        };
      case 'DEV_ACTIVITY':
        return {
          glow: 'shadow-[0_4px_30px_rgba(14,165,233,0.22)]',
          border: 'border-sky-500/40 hover:border-sky-400/70',
          badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          barBg: 'bg-gradient-to-r from-sky-500 to-cyan-400',
          icon: ShieldAlert,
          label: 'DEVELOPER ACTIVITY',
        };
      case 'LAUNCHPAD_MILESTONE':
        return {
          glow: 'shadow-[0_4px_30px_rgba(245,158,11,0.22)]',
          border: 'border-amber-500/40 hover:border-amber-400/70',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          barBg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
          icon: Crown,
          label: milestone?.type === 'KOTH' ? 'KING OF THE HILL' : 'GRADUATION',
        };
      case 'RISK_ALERT':
        return {
          glow: 'shadow-[0_4px_30px_rgba(244,63,94,0.22)]',
          border: 'border-rose-500/40 hover:border-rose-400/70',
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          barBg: 'bg-gradient-to-r from-rose-500 to-pink-500',
          icon: ShieldAlert,
          label: 'RISK DETECTED',
        };
      default:
        return {
          glow: 'shadow-[0_4px_30px_rgba(56,189,248,0.2)]',
          border: 'border-sky-500/40',
          badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          barBg: 'bg-sky-500',
          icon: Zap,
          label: 'ALERT',
        };
    }
  };

  const theme = getCategoryTheme(type);
  const CategoryIcon = theme.icon;

  const formatMarketCap = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div
      role="region"
      aria-label="Real-time Trade Alert"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        'fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-50 w-[94vw] sm:w-[410px] max-w-[410px]',
        'animate-in slide-in-from-top-4 fade-in duration-300 select-none'
      )}
    >
      <div
        className={clsx(
          'relative overflow-hidden rounded-xl border bg-sentinel-950/98 backdrop-blur-xl shadow-2xl',
          'transition-all duration-200 text-slate-100',
          theme.border,
          theme.glow
        )}
      >
        {/* Top Meta Bar */}
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1 border-b border-white/[0.06] bg-black/40 text-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Category Pill */}
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-mono font-bold uppercase tracking-wider border shrink-0',
                theme.badgeBg
              )}
            >
              <CategoryIcon className="w-2.5 h-2.5" />
              <span>{theme.label}</span>
            </span>

            {/* Caller or Trader Identity */}
            {caller && (
              <div className="flex items-center gap-1 min-w-0 truncate">
                {caller.avatarUrl && (
                  <img
                    src={caller.avatarUrl}
                    alt={caller.name}
                    className="w-3.5 h-3.5 rounded-full object-cover border border-white/20 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${caller.handle}`;
                    }}
                  />
                )}
                <span className="font-semibold text-slate-200 text-3xs truncate">{caller.name}</span>
                {caller.isVerified && (
                  <span title="Verified Alpha Caller" className="inline-flex items-center shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                  </span>
                )}
                {caller.winRate && (
                  <span className="px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 font-mono text-4xs shrink-0">
                    {caller.winRate}% WR
                  </span>
                )}
              </div>
            )}

            {trade && (
              <div className="flex items-center gap-1 truncate font-mono text-3xs min-w-0">
                <span className="text-slate-400 truncate">{trade.traderLabel || trade.traderAddress}</span>
                {trade.winRate30d && (
                  <span className="px-1 py-0.2 rounded bg-purple-950/80 border border-purple-800/40 text-purple-300 text-4xs shrink-0">
                    {trade.winRate30d}% WR
                  </span>
                )}
              </div>
            )}

            {milestone && (
              <span className="text-amber-300 font-medium text-3xs truncate">{milestone.description}</span>
            )}
          </div>

          {/* Right Controls: Sound, Feed Drawer, Dismiss */}
          <div className="flex items-center gap-1 shrink-0 ml-1.5">
            <button
              onClick={toggleSound}
              className={clsx(
                'p-1 rounded hover:bg-white/10 transition',
                soundEnabled ? 'text-sky-400' : 'text-slate-500'
              )}
              title={soundEnabled ? 'Alert audio ON (Click to mute)' : 'Alert audio MUTED (Click to unmute)'}
            >
              {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setHistoryDrawerOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition font-mono text-3xs"
              title="Open Live Alerts History"
            >
              <History className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Feed</span>
              {unreadCount > 1 && (
                <span className="px-1 rounded-full bg-sky-500 text-black font-bold text-4xs">
                  +{unreadCount - 1}
                </span>
              )}
            </button>

            <button
              onClick={dismissActiveAlert}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Dismiss alert"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-2.5 flex items-start gap-2.5">
          {/* Token Avatar + Launchpad Badge */}
          <div className="relative shrink-0">
            <img
              src={token.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`}
              alt={token.symbol}
              className="w-8 h-8 rounded-lg object-cover bg-sentinel-900 border border-white/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${token.symbol}`;
              }}
            />
            {token.launchpad && token.launchpad !== 'unknown' && (
              <span
                className={clsx(
                  'absolute -bottom-1 -right-1 px-0.5 py-0.2 rounded font-mono text-4xs font-bold uppercase border shadow-sm scale-90',
                  token.launchpad === 'pump.fun'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : 'bg-sky-950 text-sky-300 border-sky-700/60'
                )}
              >
                {token.launchpad === 'pump.fun' ? 'PUMP' : 'RAY'}
              </span>
            )}
          </div>

          {/* Token Details & Message Text */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-bold text-xs text-white tracking-tight">${token.symbol}</span>
                <span className="text-3xs text-slate-400 truncate max-w-[90px] hidden sm:inline">
                  {token.name}
                </span>
                <span className="px-1 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] text-slate-300 font-numeric text-3xs">
                  {formatMarketCap(token.marketCapUsd)}
                </span>
                {token.priceChange24h !== undefined && (
                  <span
                    className={clsx(
                      'font-mono text-3xs font-semibold px-1 rounded',
                      token.priceChange24h >= 0
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    )}
                  >
                    {token.priceChange24h >= 0 ? '+' : ''}
                    {token.priceChange24h}%
                  </span>
                )}
              </div>

              {/* Trade or Call Sol Tag */}
              {trade && (
                <div className="text-right shrink-0">
                  <span className="font-mono text-2xs font-bold text-purple-300">
                    +{trade.amountSol} SOL
                  </span>
                  <span className="text-4xs text-slate-400 block font-numeric">
                    ${trade.amountUsd != null ? trade.amountUsd.toLocaleString() : '—'}
                  </span>
                </div>
              )}
            </div>

            {/* Headline / Message */}
            <p className="text-2xs text-slate-300 line-clamp-2 leading-relaxed">
              {headline ? <strong className="text-white font-medium">{headline}: </strong> : null}
              {message}
            </p>
          </div>

          {/* Fast Action Buttons */}
          <div className="flex flex-col gap-1 shrink-0 self-center">
            {/* Quick Buy Button */}
            <button
              onClick={handleQuickBuy}
              className={clsx(
                'flex items-center justify-center gap-1 px-2.5 py-1 rounded-md font-mono text-2xs font-bold transition shadow-sm select-none',
                'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-95'
              )}
              title={`Quick Buy $${token.symbol} (${quickBuyDefaultSol} SOL)`}
            >
              <Zap className="w-3 h-3 fill-current" />
              <span>Buy {quickBuyDefaultSol}</span>
            </button>

            {/* Chart Button */}
            <button
              onClick={handleOpenChart}
              className="flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-sentinel-850 hover:bg-sentinel-800 border border-sentinel-700 text-slate-300 hover:text-white transition font-mono text-3xs"
              title="Open Chart in Terminal"
            >
              <BarChart2 className="w-2.5 h-2.5 text-sky-400" />
              <span>Chart</span>
            </button>
          </div>
        </div>

        {/* Auto-Dismiss Progress Bar */}
        <div className="h-0.5 w-full bg-white/[0.08]">
          <div
            className={clsx('h-full transition-all ease-linear', theme.barBg)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
