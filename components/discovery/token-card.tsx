'use client';

import React, { useState, useEffect, useMemo, useRef, useId, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  Crown,
  Eye,
  UserRound,
  Zap,
  Star,
  Twitter,
  Search,
  Globe,
  Send,
  EyeOff,
  UserX,
  BellOff,
  Coins,
  Flame,
  GraduationCap,
  MoreHorizontal,
  ExternalLink,
  Users,
  Trophy,
  Award,
  ShieldCheck,
  ChevronDown,
  Target,
  Bell,
} from 'lucide-react';
import { useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import { useTokenFilters } from '@/lib/store/token-filters-store';
import type { LiveTokenUpdate } from '@/lib/hooks/use-live-token-updates';
import type { DiscoveryToken, TimeWindow, MetricEvidence } from '@/lib/discovery/types';
import {
  resolveLaunchpad,
  type LaunchpadConfig,
} from '@/lib/market/lifecycle/launchpads';
import { formatCompactUsd, formatTokenPrice, formatSolFloorPrice, formatCount as formatCountBase, formatBoostCountdown, formatDisplaySource } from '@/lib/discovery/format';
import { useSolPrice } from '@/lib/hooks/use-sol-price';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { AuditPills } from '@/components/ui/audit-pills';
import { SecurityPills } from '@/components/ui/security-pills';
import { RugRiskPill } from '@/components/ui/rug-risk-pill';
import { currentRiskRating } from '@/lib/discovery/audit-freshness';
import { MetricValue } from '@/components/ui/metric-value';
import { toValueState } from '@/lib/ui/value-state';
import { mergeTokenCardSnapshot } from '@/lib/discovery/card-snapshot';
import { Popover } from '@/components/ui/popover';

export interface TokenDiscoveryCardProps {
  token: DiscoveryToken;
  variant?: 'compact' | 'expanded';
  quickBuyPresets?: number[]; // In SOL or USD
  quickBuyMode?: 'sol' | 'usd';
  timeWindow?: TimeWindow;
  onQuickBuy?: (token: DiscoveryToken, amount: number) => void;
  /**
   * Latest streamed values for this mint, from the column's single planned
   * subscription. Undefined means no update has arrived yet.
   */
  live?: LiveTokenUpdate;
  /**
   * True when the subscription budget ran out before reaching this token.
   *
   * The card must not animate as though it were streaming when it is not —
   * that is the same "looks live, never updates" failure that made the missing
   * subscriptions invisible in the first place.
   */
  liveUnavailable?: boolean;
  onVisibilityChange?: (mint: string, visible: boolean) => void;
}

export function formatCompactUSD(val: number | string | undefined): string {
  const out = formatCompactUsd(val);
  return out === '—' ? '—' : `$${out}`;
}

export function formatSmartPrice(val: number | string | undefined): string {
  const out = formatTokenPrice(val);
  return out === '—' ? '—' : `$${out}`;
}

export const formatCount = formatCountBase;

function CardSocialLinks({ token }: { token: DiscoveryToken }) {
  const links = [
    { href: token.websiteUrl, label: 'Website', Icon: Globe },
    { href: token.telegramUrl, label: 'Telegram', Icon: Send },
    { href: token.twitterUrl || `https://x.com/search?q=${encodeURIComponent(token.mint)}`, label: token.twitterUrl ? 'Official X account' : 'Search X for this contract address', Icon: Twitter },
    { href: `https://solscan.io/token/${token.mint}`, label: 'Solscan', Icon: Search },
  ];
  return <div className="discovery-card-socials flex items-center gap-0.5 text-slate-500">
    {links.filter(link => link.href).map(({ href, label, Icon }) => (
      <Link key={label} href={href!} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}
        title={label} aria-label={label} className="discovery-icon-button">
        <Icon size={14} />
      </Link>
    ))}
  </div>;
}

function finiteOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function evidenceIsCurrent(liveEvidence: MetricEvidence | undefined, restEvidence: MetricEvidence | undefined): boolean {
  if (!liveEvidence) return false;
  if (!restEvidence) return true;
  const liveAt = Date.parse(liveEvidence.observedAt);
  const restAt = Date.parse(restEvidence.observedAt);
  return !Number.isFinite(restAt) || (Number.isFinite(liveAt) && liveAt >= restAt);
}

function effectiveEvidence(evidence: MetricEvidence | undefined): MetricEvidence | undefined {
  if (!evidence?.expiresAt || evidence.status !== 'measured') return evidence;
  return Date.parse(evidence.expiresAt) < Date.now() ? { ...evidence, status: 'stale' } : evidence;
}

function CardMetric({
  label,
  value,
  evidence,
  format,
  className = '',
}: {
  label: string;
  value: number | string | undefined | null;
  evidence?: MetricEvidence;
  format: (value: number) => string;
  className?: string;
}) {
  const resolvedEvidence = effectiveEvidence(evidence);
  const numeric = value === '' || value === undefined || value === null ? null : Number(value);
  const state = toValueState(numeric, {
    isPending: resolvedEvidence?.status === 'loading',
    isStale: resolvedEvidence?.status === 'stale' || (resolvedEvidence?.status === 'unavailable' && numeric !== null),
    reason: resolvedEvidence?.reason,
  });
  const observed = resolvedEvidence?.observedAt ? new Date(resolvedEvidence.observedAt).toLocaleTimeString() : null;
  return (
    <MetricValue
      state={state}
      label={observed ? `${label} · ${formatDisplaySource(resolvedEvidence?.source)} at ${observed}` : label}
      format={format}
      className={className}
    />
  );
}

function SafetyValue({
  label,
  value,
  evidence,
  suffix = '',
  format = (input) => String(input),
}: {
  label: string;
  value: number | undefined | null;
  evidence?: MetricEvidence;
  suffix?: string;
  format?: (value: number) => string;
}) {
  const state = value == null || !Number.isFinite(value)
    ? evidence?.status === 'loading' ? 'pending' : 'unknown'
    : evidence?.status === 'stale' ? 'stale' : 'measured';
  const color = state === 'measured' ? 'text-slate-200' : state === 'stale' ? 'text-amber-400' : 'text-slate-500';
  const rendered = state === 'pending' ? '…' : state === 'unknown' ? '—' : `${format(value as number)}${suffix}`;
  return <span className="flex items-center justify-between gap-2"><span className="text-slate-500">{label}</span><span className={`font-mono ${color}`} title={formatDisplaySource(evidence?.source)}>{rendered}</span></span>;
}

function SafetyFlag({ label, value, evidence }: { label: string; value: boolean | undefined; evidence?: MetricEvidence }) {
  const state = value === undefined ? evidence?.status === 'loading' ? 'pending' : 'unknown' : evidence?.status === 'stale' ? 'stale' : 'measured';
  const rendered = state === 'pending' ? '…' : state === 'unknown' ? '—' : value ? 'Yes' : 'No';
  const color = state === 'measured' ? value ? 'text-emerald-400' : 'text-rose-400' : state === 'stale' ? 'text-amber-400' : 'text-slate-500';
  return <span className="flex items-center justify-between gap-2"><span className="text-slate-500">{label}</span><span className={`font-mono ${color}`} title={formatDisplaySource(evidence?.source)}>{rendered}</span></span>;
}

/** Live-ticking relative time formatter: 7s, 47s, 1m, 2m, 1h, 1d */
export function formatLiveAge(ageMinutes: number, elapsedSec: number): string {
  const totalSec = Math.max(1, Math.round(ageMinutes * 60 + elapsedSec));
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const TokenDiscoveryCard = memo(function TokenDiscoveryCard({
  token,
  variant = 'compact',
  quickBuyPresets = [0.05, 0.1, 0.5, 1.0],
  quickBuyMode = 'sol',
  timeWindow = '5m',
  onQuickBuy,
  live,
  liveUnavailable = false,
  onVisibilityChange,
}: TokenDiscoveryCardProps) {
  const router = useRouter();
  const { setQuickBuyOpen, addNotification, setSelectedToken, setActiveView } = useAppActions();
  const { isWatchlisted: checkWatchlisted, toggleWatchlist } = useWatchlist();
  const { hideToken, blacklistDev, muteSocial, isTokenHidden, isDevBlacklisted, isSocialMuted } = useTokenFilters();

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copied = copyState === 'copied';
  const [showSafety, setShowSafety] = useState(false);
  const safetyId = useId();
  const [flash, setFlash] = useState<'BUY' | 'SELL' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const liveMarket = evidenceIsCurrent(live?.marketEvidence, token.marketEvidence) ? live : undefined;

  useEffect(() => {
    const element = cardRef.current;
    if (!element || !onVisibilityChange || typeof IntersectionObserver === 'undefined') return;
    const root = element.closest('[data-discovery-scroll]');
    const observer = new IntersectionObserver(
      ([entry]) => onVisibilityChange(token.mint, entry.isIntersecting),
      { root, threshold: 0.01 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      onVisibilityChange(token.mint, false);
    };
  }, [onVisibilityChange, token.mint]);

  // Live price resolution: live WebSocket update and REST polling snapshot are compared by observation time
  const activePriceUsd = useMemo(() => {
    const livePrice = live?.priceUsd !== undefined && Number.isFinite(live.priceUsd) && live.priceUsd > 0
      ? String(live.priceUsd)
      : undefined;
    const restPrice = token.priceUsd && token.priceUsd !== '' && Number.isFinite(Number(token.priceUsd)) && Number(token.priceUsd) > 0
      ? token.priceUsd
      : undefined;

    if (livePrice && !restPrice) return livePrice;
    if (!livePrice && restPrice) return restPrice;
    if (!livePrice && !restPrice) return token.priceUsd;

    const liveObservedAt = Date.parse(live?.fieldObservedAt?.priceUsd ?? live?.observedAt ?? '') || (live?.updatedAt ?? 0);
    const restObservedAt = Date.parse(token.marketEvidence?.observedAt ?? '') || 0;

    if (liveObservedAt >= restObservedAt) {
      return livePrice!;
    }
    return restPrice!;
  }, [live?.priceUsd, live?.fieldObservedAt?.priceUsd, live?.observedAt, live?.updatedAt, token.priceUsd, token.marketEvidence?.observedAt]);

  // Flash border green on price increase, rose on price decrease
  const previousPriceRef = useRef<number | null>(null);
  useEffect(() => {
    const currentPriceNum = Number(activePriceUsd);
    if (!Number.isFinite(currentPriceNum) || currentPriceNum <= 0) return;

    if (previousPriceRef.current !== null && previousPriceRef.current !== currentPriceNum) {
      const side = currentPriceNum > previousPriceRef.current ? 'BUY' : 'SELL';
      setFlash(side);
      const timer = setTimeout(() => setFlash(null), 850);
      previousPriceRef.current = currentPriceNum;
      return () => clearTimeout(timer);
    }
    previousPriceRef.current = currentPriceNum;
  }, [activePriceUsd]);

  const initialBuys = timeWindow === '24h' ? token.buysCount24h : timeWindow === '1h' ? token.buysCount1h : token.buysCount5m;
  const initialSells = timeWindow === '24h' ? token.sellsCount24h : timeWindow === '1h' ? token.sellsCount1h : token.sellsCount5m;
  const [liveTxCount, setLiveTxCount] = useState<number | null>(() => {
    const txs = finiteOrNull(timeWindow === '24h' ? token.txCount24h : timeWindow === '1h' ? token.txCount1h : token.txCount5m);
    const buys = finiteOrNull(initialBuys);
    const sells = finiteOrNull(initialSells);
    return txs ?? (buys !== null && sells !== null ? buys + sells : null);
  });
  const [liveBuys, setLiveBuys] = useState<number | null>(finiteOrNull(initialBuys));
  const [liveSells, setLiveSells] = useState<number | null>(finiteOrNull(initialSells));
  const lastAppliedTradeRef = useRef<number | null>(null);

  useEffect(() => {
    const buys = timeWindow === '24h' ? token.buysCount24h : timeWindow === '1h' ? token.buysCount1h : token.buysCount5m;
    const sells = timeWindow === '24h' ? token.sellsCount24h : timeWindow === '1h' ? token.sellsCount1h : token.sellsCount5m;
    const txs = timeWindow === '24h' ? token.txCount24h : timeWindow === '1h' ? token.txCount1h : token.txCount5m;
    const measuredBuys = finiteOrNull(buys);
    const measuredSells = finiteOrNull(sells);
    setLiveBuys(measuredBuys);
    setLiveSells(measuredSells);
    setLiveTxCount(finiteOrNull(txs) ?? (measuredBuys !== null && measuredSells !== null ? measuredBuys + measuredSells : null));
  }, [timeWindow, token.mint, token.buysCount5m, token.buysCount1h, token.buysCount24h, token.sellsCount5m, token.sellsCount1h, token.sellsCount24h, token.txCount5m, token.txCount1h, token.txCount24h]);

  // Live elapsed ticker for seconds-accurate age
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Paid Boost countdown.
   *
   * Only a real, reported expiry counts down. The demo fallback that used to
   * sit here invented a timer for **every** pump.fun token under six minutes
   * old — so a countdown that looked like paid promotion was really just an
   * age gauge, and it rendered on launches nobody had paid a cent for.
   *
   * `isBoosted` no longer implies 300 seconds either: DexScreener publishes a
   * boost's amount but no expiry, so a boosted token shows that it is boosted
   * and nothing more. A number here would be a guess wearing a clock face.
   */
  const initialBoost = useMemo(() => {
    if (token.boostCountdown !== undefined) return token.boostCountdown;
    if (token.bumpCountdown !== undefined) return token.bumpCountdown;
    return 0;
  }, [token.boostCountdown, token.bumpCountdown]);

  const [boostRemaining, setBoostRemaining] = useState<number>(initialBoost);
  useEffect(() => {
    setBoostRemaining(initialBoost);
  }, [initialBoost]);

  useEffect(() => {
    if (boostRemaining <= 0) return;
    const timer = setInterval(() => {
      setBoostRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [boostRemaining]);

  const formattedBoost = useMemo(() => {
    return formatBoostCountdown(boostRemaining);
  }, [boostRemaining]);

  /**
   * The deployer's X handle, read from metadata — never guessed.
   *
   * The `@{symbol}coin` fallback that used to close this function invented a
   * handle for every pump.fun token without one, and the card linked to it.
   * Most such accounts do not exist; some belong to unrelated people. A token
   * with no social metadata now shows no handle, which is the truth about it.
   */
  const twitterHandle = useMemo(() => {
    if (token.twitterHandle) return token.twitterHandle;
    if (token.twitterUrl) {
      const match = token.twitterUrl.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i);
      if (match && match[1]) return `@${match[1]}`;
    }
    return undefined;
  }, [token.twitterHandle, token.twitterUrl]);

  /**
   * Follower count, only when something actually measured it.
   *
   * This was `(hash * 47) % 85000 + 1200` over the handle's character codes —
   * a stable, plausible-looking number derived from the spelling of the name
   * and nothing else. It sat beside the handle as evidence of reach, and a
   * throwaway account with 12 followers could render as 40k.
   *
   * Nothing populates `twitterFollowers` today: it needs the paid X API. Until
   * then this is undefined and the card omits the figure.
   */
  const twitterFollowers = token.twitterFollowers;

  /**
   * Live values arrive as a prop, from one planned subscription per column.
   *
   * Each card used to open its own `useSentinelWS` subscription for
   * `token.trade:<mint>` and `token.price:<mint>`. Those all landed on one
   * shared socket, and a session is capped at 30 concurrent topics — so with
   * 42 cards mounted the browser asked for 84 and the server refused the
   * excess. Measured: **16 `SUBSCRIPTION_LIMIT` frames per page load**, with
   * most cards silently receiving nothing while still looking live.
   *
   * `terminal-column.tsx` now subscribes once through `planTokenTopics`, which
   * gives every visible mint a price stream before any mint gets a second
   * topic, and passes each card its own slice.
   */
  useEffect(() => {
    if (!live) return;

    const exactTx = timeWindow === '24h'
      ? (liveMarket?.txCount24h ?? live.txCount5m)
      : timeWindow === '1h'
        ? (liveMarket?.txCount1h ?? live.txCount5m)
        : (liveMarket?.txCount5m ?? live.txCount5m);
    const exactBuys = timeWindow === '24h'
      ? (liveMarket?.buysCount24h ?? live.buysCount5m)
      : timeWindow === '1h'
        ? (liveMarket?.buysCount1h ?? live.buysCount5m)
        : (liveMarket?.buysCount5m ?? live.buysCount5m);
    const exactSells = timeWindow === '24h'
      ? (liveMarket?.sellsCount24h ?? live.sellsCount5m)
      : timeWindow === '1h'
        ? (liveMarket?.sellsCount1h ?? live.sellsCount5m)
        : (liveMarket?.sellsCount5m ?? live.sellsCount5m);
    if (exactTx !== undefined) setLiveTxCount(exactTx);
    if (exactBuys !== undefined) setLiveBuys(exactBuys);
    if (exactSells !== undefined) setLiveSells(exactSells);

    if (
      live.lastTradeSide
      && live.lastTradeUpdatedAt
      && live.lastTradeUpdatedAt !== lastAppliedTradeRef.current
    ) {
      lastAppliedTradeRef.current = live.lastTradeUpdatedAt;
      const side = live.lastTradeSide;
      setFlash(side);
      // A sampled trade is not a complete rolling-window count. Only the
      // provider's window snapshots set totals; trades still flash immediately.
      const timer = setTimeout(() => setFlash(null), 850);
      return () => clearTimeout(timer);
    }
    // A market/evidence patch retains the last trade side, so only the trade's
    // own receipt stamp may increment counters or flash the card.
  }, [live?.updatedAt, live?.lastTradeSide, live?.lastTradeUpdatedAt, live?.priceUsd, live, liveMarket, timeWindow]);

  const isWatchlisted = checkWatchlisted(token.mint);
  const marketCapUsd = useMemo(() => {
    if (live?.marketCapUsd !== undefined && live.marketCapUsd !== '') {
      return live.marketCapUsd;
    }
    if (liveMarket?.marketCapUsd !== undefined && liveMarket.marketCapUsd !== '') {
      return liveMarket.marketCapUsd;
    }
    const tokenPriceNum = Number(token.priceUsd);
    const tokenMcapNum = Number(token.marketCapUsd);
    const activePriceNum = Number(activePriceUsd);
    if (
      Number.isFinite(activePriceNum) &&
      activePriceNum > 0 &&
      Number.isFinite(tokenPriceNum) &&
      tokenPriceNum > 0 &&
      Number.isFinite(tokenMcapNum) &&
      tokenMcapNum > 0
    ) {
      const updatedMcap = tokenMcapNum * (activePriceNum / tokenPriceNum);
      return String(Math.round(updatedMcap));
    }
    return token.marketCapUsd;
  }, [live?.marketCapUsd, liveMarket?.marketCapUsd, activePriceUsd, token.priceUsd, token.marketCapUsd]);

  const liquidityUsd = live?.liquidityUsd ?? liveMarket?.liquidityUsd ?? token.liquidityUsd;

  const handleOpenTrade = () => {
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoURI,
      priceUsd: activePriceUsd || token.priceUsd,
      marketCapUsd,
      liquidityUsd,
      chain: token.chain || 'solana',
    });
    setActiveView('trade');
    router.push(`/trade/${token.chain || 'solana'}/${token.mint}`);
  };

  const handleCopyAddress = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(token.mint);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
      addNotification({
        title: 'Copy failed',
        message: 'The contract address could not be copied. Select it from Solscan instead.',
        type: 'system',
      });
      setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const willWatchlist = !isWatchlisted;
    toggleWatchlist(token.mint, {
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      priceUsd: formatSmartPrice(activePriceUsd || token.priceUsd),
      priceChange24h: priceChange ?? undefined,
      marketCapUsd: formatCompactUSD(marketCapUsd),
      liquidityUsd: formatCompactUSD(liquidityUsd),
      riskRating: currentRiskRating(rugRisk, [ownershipEvidence, securityEvidence, live?.liquidityEvidence ?? token.liquidityEvidence]),
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

    if (onQuickBuy && amount) {
      onQuickBuy(token, amount);
      return;
    }
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: (activePriceUsd || token.priceUsd),
      mcap: marketCapUsd,
      customAmountSol: quickBuyMode === 'sol' ? amount : undefined,
      customAmountUsd: quickBuyMode === 'usd' ? amount : undefined,
      liquidity: liquidityUsd,
      volume24h: live?.volume24hUsd ?? liveMarket?.volume24hUsd ?? token.volume24hUsd,
      priceChange24h: live?.priceChange24h ?? liveMarket?.priceChange24h ?? token.priceChange24h,
      holders: live?.holdersCount ?? token.holdersCount,
      logoURI: token.logoURI,
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

  // Bonding / Lifecycle Status Resolution
  /**
   * Real curve completion, or null.
   *
   * This fell back to a literal **28** for any new pair with no curve reading,
   * and 99 for anything mid-migration — so a token nobody had measured drew a
   * bonding bar a quarter of the way along. The bar is now omitted entirely
   * when the curve has not been read.
   */
  const lifecycle = live ? mergeTokenCardSnapshot(token, {
    mint: token.mint, sequence: 0, source: 'token.card', freshness: 'fresh',
    observedAt: live.observedAt ?? '', fieldObservedAt: live.fieldObservedAt,
    changedFields: {
      lifecycleState: live.lifecycleState, lifecycleEvidence: live.lifecycleEvidence,
      bondingCurveProgress: live.bondingCurveProgress, migratedAt: live.migratedAt,
      migrationSignature: live.migrationSignature, migratedPool: live.migratedPool, migratedDex: live.migratedDex,
    },
  }) : token;
  const curvePct = lifecycle.bondingCurveProgress ?? lifecycle.migrationProgress ?? null;
  const curveStale = lifecycle.lifecycleEvidence?.status === 'stale';

  // Launchpad Resolution & Profile
  const launchpadConfig: LaunchpadConfig = token.launchpadInfo ?? resolveLaunchpad(token);
  const originLaunchpad = token.originLaunchpad ?? launchpadConfig.name;
  const destinationDex = lifecycle.migratedDex ?? token.launchpadInfo?.destinationDex ?? launchpadConfig.destinationDex;
  const gradTarget = token.graduationTarget ?? launchpadConfig.graduationThreshold;

  // Platform & Protocol label
  const protocolLabel = token.protocol || (launchpadConfig ? launchpadConfig.name : (token.source === 'Pump.fun' ? 'Pump V1' : token.source));

  const lifecycleState = lifecycle.lifecycleState;
  const isMigrated = lifecycleState === 'migrated' || token.bondingStatus === 'graduated';
  const isMigrating = !isMigrated && (
    lifecycleState === 'migrating' ||
    token.bondingStatus === 'migrating'
  );
  const migrationAgeMinutes = isMigrated && typeof lifecycle.migratedAt === 'number'
    ? Math.max(0, (Date.now() - lifecycle.migratedAt) / 60_000) : null;

  // Trader / Holder stats
  /**
   * Crowd composition. Reported or absent — never derived from holder count.
   *
   * `proTraders` was `holdersCount * 0.12` and `kols` was `holdersCount *
   * 0.04`, so both were the holder count wearing a different label: a token
   * with 190 holders always claimed 22 pro traders and 7 KOLs, and the two
   * numbers moved in lockstep because they were the same number. Neither has a
   * producer anywhere in the codebase.
   *
   * `recentVisitors` was `(hash of the last 4 mint characters) % 180 + 12` — a
   * constant per token, forever, presented as live attention.
   */
  const proTraders = live?.proTradersCount ?? token.proTradersCount ?? token.smartMoneyCount ?? null;
  const kols = live?.kolsCount ?? token.kolsCount ?? null;
  const recentVisitors = token.recentVisitors ?? token.viewsCount ?? null;

  /**
   * The deployer's graduated/launched record, e.g. `33/34`.
   *
   * Both fallbacks returned `'1/1'` — a perfect record — for any token Jupiter
   * had not reported on. That is the single most reassuring value the field can
   * hold, and it was the default for unknown deployers.
   */
  const devMints = live?.devMints ?? token.devMints;
  const devMigrations = live?.devMigrations ?? token.devMigrations;
  const devRecord = useMemo(() => {
    if (devMints !== undefined && devMints > 0 && devMigrations != null && Number.isFinite(devMigrations)) {
      return `${devMigrations}/${devMints}`;
    }
    return null;
  }, [devMints, devMigrations]);

  // Risk / Audit percentages, canonically ordered.
  //
  // Every one of these was a constant. `auditPending` is set by nothing in any
  // live path, so `x ?? (token.auditPending ? null : 4)` always resolved to the
  // constant: every card in the feed showed Snipers 4%, Insiders 2%,
  // Bundlers 0% and Top 10 22%. Against the thresholds below (>10, >5, >5, >30)
  // all four render green — so every token in the feed, including outright
  // farms, advertised a clean audit that nothing had performed.
  //
  // These need holder enumeration and tx-history scans that no free RPC
  // serves; they stay null until the enrichment pipeline has a funded key.
  // 1. Top 10 Holders %
  const top10 = live?.top10HoldingsPct ?? token.top10HoldingsPct ?? null;
  // 2. Dev Holding % + how long ago the deployer's wallet was funded
  const devHoldings = live?.devHoldingsPct ?? token.devHoldingsPct ?? null;
  // Was falling back to the *token's* age, which is a different fact entirely:
  // a wallet funded two years ago launching a 40-second-old token displayed
  // "40s", turning the strongest sybil signal on the card into a duplicate of
  // the age field.
  const devWalletAge = live?.devWalletAge ?? token.devWalletAge ?? null;
  // 3. Snipers %
  const snipersPct = live?.sniperPercentage ?? token.sniperPercentage ?? null;
  // 4. Insiders %
  const insidersPct = live?.insiderHoldingsPct ?? token.insiderHoldingsPct ?? null;
  // 5. Bundlers %
  const bundlerPct = live?.bundlerPercentage ?? token.bundlerPercentage ?? null;

  // Market metrics
  const metricWindow = timeWindow === '1h' ? '1h' : timeWindow === '24h' ? '24h' : '5m';
  const volumeDisplay = useMemo(() => {
    const liveVol = metricWindow === '1h'
      ? (live?.volume1hUsd ?? liveMarket?.volume1hUsd)
      : metricWindow === '24h'
        ? (live?.volume24hUsd ?? liveMarket?.volume24hUsd)
        : (live?.volume5mUsd ?? liveMarket?.volume5mUsd);
    const restVol = metricWindow === '1h'
      ? token.volume1hUsd
      : metricWindow === '24h'
        ? token.volume24hUsd
        : token.volume5mUsd;
    const volField = metricWindow === '1h' ? 'volume1hUsd' : metricWindow === '24h' ? 'volume24hUsd' : 'volume5mUsd';
    const liveObservedAt = Date.parse(live?.fieldObservedAt?.[volField] ?? live?.observedAt ?? '') || (live?.updatedAt ?? 0);
    const restObservedAt = Date.parse(token.activityEvidence?.observedAt ?? token.marketEvidence?.observedAt ?? '') || 0;
    if (liveVol && liveObservedAt >= restObservedAt) {
      return liveVol;
    }
    return restVol ?? liveVol;
  }, [metricWindow, live?.volume1hUsd, live?.volume24hUsd, live?.volume5mUsd, liveMarket?.volume1hUsd, liveMarket?.volume24hUsd, liveMarket?.volume5mUsd, live?.fieldObservedAt, live?.observedAt, live?.updatedAt, token.volume1hUsd, token.volume24hUsd, token.volume5mUsd, token.activityEvidence?.observedAt, token.marketEvidence?.observedAt]);
  // Fees were `volume * 0.01` — an assumed 1% rate applied to every token
  // regardless of its actual fee configuration, rendered as a measured SOL
  // amount. Shown only when a real figure is supplied.
  const feeAccrued = token.feeAccruedUsd ?? null;

  /**
   * Dex Paid — only from an approved DexScreener order.
   *
   * The fallback here was `Boolean(token.isBoosted || initialBoost > 0)`, so an
   * active boost implied a paid listing. They are separate purchases: measured
   * across 17 trending tokens, **12 were Dex Paid and none were boosted**, so
   * that inference reported false on every one of them.
   *
   * Undefined means the lookup has not completed — the badge stays hidden
   * rather than asserting the token has not paid.
   */
  const isDexPaid = (live?.isDexPaid ?? token.isDexPaid) === true;

  /** How long the listing has been paid for, e.g. `703d` — Axiom's "DS 1y". */
  const dexPaidAge = useMemo(() => {
    const paidAt = live?.dexPaidAt ?? token.dexPaidAt;
    if (paidAt === undefined) return null;
    const days = Math.floor((Date.now() - paidAt) / 86_400_000);
    if (days >= 365) return `${Math.floor(days / 365)}y`;
    if (days >= 1) return `${days}d`;
    return 'new';
  }, [live?.dexPaidAt, token.dexPaidAt]);

  const solPriceUsd = useSolPrice();
  const priceInSol = useMemo(() => {
    const numericPrice = Number(activePriceUsd || token.priceUsd);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return null;
    const solRate = solPriceUsd && solPriceUsd > 0 ? solPriceUsd : 150;
    return numericPrice / solRate;
  }, [activePriceUsd, token.priceUsd, solPriceUsd]);
  const solFloorPriceFormatted = useMemo(() => formatSolFloorPrice(priceInSol), [priceInSol]);

  /**
   * Buy share of recent trades, from live counts when they are streaming.
   * Null when nothing has traded — "%B" with no number is worse than nothing.
   */
  const buyPct = (() => {
    if (liveBuys === null || liveSells === null) return null;
    const total = liveBuys + liveSells;
    if (total > 0) return Math.round((liveBuys / total) * 100);
    const ratio = token.buyPressureRatio;
    return ratio === undefined || ratio === null || !Number.isFinite(ratio) ? null : Math.round(ratio * 100);
  })();

  /** Colour for the graduated/launched fraction: a low rate is the signal. */
  const devRateFg = (() => {
    if (devMints === undefined || devMints === 0 || devMigrations == null) return 'text-slate-400';
    const rate = devMigrations / devMints;
    if (devMints < 10) return 'text-slate-400';
    return rate < 0.02 ? 'text-rose-400' : rate < 0.1 ? 'text-amber-400' : 'text-emerald-400';
  })();

  const selectedPriceChange = useMemo(() => {
    const liveChange = metricWindow === '1h'
      ? (live?.priceChange1h ?? liveMarket?.priceChange1h)
      : metricWindow === '24h'
        ? (live?.priceChange24h ?? liveMarket?.priceChange24h)
        : (live?.priceChange5m ?? liveMarket?.priceChange5m);
    const restChange = metricWindow === '1h'
      ? token.priceChange1h
      : metricWindow === '24h'
        ? token.priceChange24h
        : token.priceChange5m;
    const changeField = metricWindow === '1h' ? 'priceChange1h' : metricWindow === '24h' ? 'priceChange24h' : 'priceChange5m';
    const liveObservedAt = Date.parse(live?.fieldObservedAt?.[changeField] ?? live?.observedAt ?? '') || (live?.updatedAt ?? 0);
    const restObservedAt = Date.parse(token.marketEvidence?.observedAt ?? '') || 0;
    if (liveChange !== undefined && Number.isFinite(liveChange) && liveObservedAt >= restObservedAt) {
      return liveChange;
    }
    return Number.isFinite(restChange) ? restChange : liveChange;
  }, [metricWindow, live?.priceChange1h, live?.priceChange24h, live?.priceChange5m, liveMarket?.priceChange1h, liveMarket?.priceChange24h, liveMarket?.priceChange5m, live?.fieldObservedAt, live?.observedAt, live?.updatedAt, token.priceChange1h, token.priceChange24h, token.priceChange5m, token.marketEvidence?.observedAt]);
  const priceChange: number | null = typeof selectedPriceChange === 'number' && Number.isFinite(selectedPriceChange) ? selectedPriceChange : null;
  const isPositive = typeof priceChange === 'number' && priceChange >= 0;
  const hasLiquidity = Number.isFinite(Number(liquidityUsd)) && Number(liquidityUsd) > 0;
  const rugRisk = live?.rugRisk ?? token.rugRisk;
  const ownershipEvidence = effectiveEvidence(live?.ownershipEvidence ?? token.ownershipEvidence);
  const isAuditLoading = (live?.auditPending ?? token.auditPending) === true || ownershipEvidence?.status === 'loading';
  const securityEvidence = effectiveEvidence(live?.securityEvidence ?? token.securityEvidence);
  const marketEvidence = effectiveEvidence(liveMarket?.marketEvidence ?? token.marketEvidence);
  const activityEvidence = effectiveEvidence(liveMarket?.activityEvidence ?? token.activityEvidence ?? marketEvidence);
  const migrationSignature = lifecycle.migrationSignature;
  const migratedPool = lifecycle.migratedPool;
  const isBondingCurve = !isMigrated && Boolean(
    token.source === 'Pump.fun' ||
    token.mint?.toLowerCase().endsWith('pump') ||
    curvePct !== null ||
    token.bondingCurveProgress != null ||
    lifecycleState === 'new_pairs' ||
    lifecycleState === 'final_stretch' ||
    lifecycleState === 'migrating' ||
    token.bondingStatus === 'bonding' ||
    token.bondingStatus === 'migrating'
  );
  const hasConfirmedVenue = Boolean(
    token.mint && token.mint.length >= 32 && (
      isBondingCurve ||
      lifecycleState === 'new_pairs' ||
      lifecycleState === 'final_stretch' ||
      migratedPool ||
      live?.liquidityPoolAddress ||
      token.liquidityPoolAddress ||
      hasLiquidity
    )
  );

  // Filter hidden tokens
  const devAddress = live?.devAddress ?? token.devAddress;
  if (isTokenHidden(token.mint) || isDevBlacklisted(devAddress) || isSocialMuted(twitterHandle)) {
    return null;
  }

  const isHighMcap = Number(marketCapUsd) >= 40000 || isMigrated;
  const snipersCountFormatted = proTraders !== null && proTraders !== undefined ? formatCount(proTraders) : '0';
  const insidersCountFormatted = kols !== null && kols !== undefined ? formatCount(kols) : '0';

  return (
    <div
      ref={cardRef}
      role="link"
      tabIndex={0}
      aria-label={`Trade ${token.symbol}`}
      onClick={handleOpenTrade}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleOpenTrade();
        }
      }}
      data-trade-flash={flash ?? undefined}
      data-variant={variant}
      className="discovery-token-card group relative min-w-0 cursor-pointer select-none"
    >
      {/* LEFT COLUMN: Media & Hover Actions */}
      <div className="discovery-card-media-col" onClick={(event) => event.stopPropagation()}>
        {/* On hover quick action buttons */}
        <div className="discovery-hover-actions">
          <button
            type="button"
            onClick={() => hideToken(token.mint)}
            title="Hide token"
            aria-label={`Hide ${token.symbol}`}
            className="discovery-icon-button"
          >
            <EyeOff size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addNotification({
                title: 'Price Alert',
                message: `Alert tracking enabled for ${token.symbol}.`,
                type: 'system',
              });
            }}
            aria-label={`Price alert for ${token.symbol}`}
            title="Set price alert"
            className="discovery-icon-button"
          >
            <Bell size={13} />
          </button>
          <Link
            href={`https://solscan.io/token/${token.mint}`}
            target="_blank"
            rel="noreferrer"
            title="Inspect on Solscan"
            aria-label={`Inspect ${token.symbol} on Solscan`}
            className="discovery-icon-button"
          >
            <Search size={13} />
          </Link>
        </div>

        {/* Square Avatar + Status Badge + Truncated Address */}
        <div className="flex flex-col items-center gap-1">
          <div className={`discovery-card-avatar-wrap border ${isMigrated ? 'border-amber-500/60' : 'border-rose-500/50'}`}>
            <TokenAvatar
              src={token.logoURI}
              symbol={token.symbol}
              name={token.name}
              mint={token.mint}
              size="lg"
              dexBadge={token.source}
              className="discovery-card-avatar"
            />
            {/* Status Pill Badge on bottom-right of avatar */}
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shadow-sm ${
                isMigrated ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-rose-500 text-white font-bold'
              }`}
              title={isMigrated ? 'Graduated pool' : 'Bonding curve'}
            >
              {isMigrated ? '👑' : '🔥'}
            </span>
          </div>

          {/* Truncated Address */}
          <button
            type="button"
            onClick={handleCopyAddress}
            className="discovery-card-address"
            aria-label={`Copy contract address for ${token.symbol}`}
            title={copied ? 'Copied' : token.mint}
          >
            {copied ? <span className="text-emerald-400 flex items-center gap-0.5"><Check size={10} /> Copied</span> : shortMint}
          </button>
        </div>
      </div>

      {/* RIGHT AREA: 5 Distinct Rows */}
      <div className="discovery-card-content">
        {/* ROW 1: Symbol + Name + Copy ... Volume + Market Cap */}
        <div className="discovery-card-row-header">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="discovery-card-symbol" title={token.symbol}>
              {token.symbol}
            </span>
            <span className="discovery-card-name" title={token.name}>
              {token.name}
            </span>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="discovery-icon-button"
              aria-label={`Copy ${token.symbol} address`}
              title={copied ? 'Copied' : 'Copy contract address'}
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            </button>
            {token.hasDeceptiveName && (
              <LegendTooltip label="Deceptive name" definition="Invisible characters were removed from this name. Verify the contract address before trading.">
                <span className="text-rose-400 text-2xs font-semibold">NAME!</span>
              </LegendTooltip>
            )}
            {(token.duplicateCount ?? 1) > 1 && (
              <LegendTooltip label="Duplicate launches" definition={`${token.duplicateCount} tokens launched together with this name and symbol. The most liquid is shown.`}>
                <span className="text-amber-400 text-2xs font-numeric">×{token.duplicateCount}</span>
              </LegendTooltip>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-xs flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium">V</span>
              <span className="font-bold text-slate-100">{formatCompactUSD(volumeDisplay)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium">MC</span>
              <span className={`font-bold ${isHighMcap ? 'text-amber-400' : 'text-sky-400'}`}>
                {formatCompactUSD(marketCapUsd)}
              </span>
            </div>
          </div>
        </div>

        {/* ROW 2: Age + Badges ... Floor Price (SOL) + TX count + Buy/Sell Bar */}
        <div className="discovery-card-row-meta">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden shrink">
            <span
              className="discovery-card-age"
              title={migrationAgeMinutes !== null ? `Since confirmed migration; launched ${token.ageFormatted || formatLiveAge(token.ageMinutes, elapsedSec)} ago` : protocolLabel}
            >
              {isMigrated && <GraduationCap size={13} className="text-purple-400" />}
              {formatLiveAge(migrationAgeMinutes ?? token.ageMinutes, migrationAgeMinutes === null ? elapsedSec : 0)}
            </span>

            {/* Bonding Curve or Migration Info */}
            {isMigrated ? (
              <span className="inline-flex items-center gap-1">
                <span className="truncate text-emerald-400 font-semibold" title={`Confirmed migration from ${originLaunchpad} to ${destinationDex || 'an AMM pool'}`}>
                  {destinationDex || 'Migrated'}
                </span>
                {migrationSignature && (
                  <Link
                    href={`https://solscan.io/tx/${migrationSignature}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="discovery-icon-button"
                    aria-label="Verify migration transaction on Solscan"
                  >
                    <ExternalLink size={12} />
                  </Link>
                )}
                {migratedPool && (
                  <Link
                    href={`https://solscan.io/account/${migratedPool}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="discovery-pool-link text-[10px] text-slate-400 hover:text-sky-300"
                    title={migratedPool}
                    aria-label="View migrated pool on Solscan"
                  >
                    {migratedPool.slice(0, 4)}…{migratedPool.slice(-4)}
                  </Link>
                )}
              </span>
            ) : isMigrating ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                <Flame size={12} /> Migrating
              </span>
            ) : curvePct !== null ? (
              <LegendTooltip
                label={`${launchpadConfig.name} bonding curve`}
                definition={`Last measured completion for ${launchpadConfig.name}. Graduation target: ${gradTarget}. Destination: ${launchpadConfig.destinationDex}. ${curveStale ? 'Delayed reading, being rechecked.' : ''}`}
              >
                <span className={`discovery-curve inline-flex items-center gap-1 font-mono text-[11px] ${curveStale ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <Flame size={12} />
                  <span className="text-[10px] text-slate-400 font-sans">Bonding curve</span>
                  <span>{curvePct.toFixed(1)}%</span>
                  <span
                    role="progressbar"
                    aria-label="Bonding curve progress"
                    aria-valuenow={curvePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="discovery-curve-track inline-block h-1 w-8 rounded-sm bg-slate-800 overflow-hidden"
                  >
                    <span style={{ width: `${Math.min(100, Math.max(0, curvePct))}%` }} className="bg-current h-full block" />
                  </span>
                </span>
              </LegendTooltip>
            ) : null}

            {/* Countdown / Boost Pill */}
            {formattedBoost && (
              <span className="inline-flex items-center gap-1 bg-rose-950/80 border border-rose-800/80 text-rose-300 rounded px-1.5 py-0.5 text-[10px] font-mono leading-none">
                <Flame size={10} className="text-rose-400" />
                <span>{formattedBoost}</span>
              </span>
            )}

            {/* Social / Link Icons */}
            <CardSocialLinks token={token} />
            {liveUnavailable && (
              <span title="Live subscription capacity reached. REST reconciliation remains active." className="text-amber-400 text-2xs">
                Delayed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs flex-shrink-0">
            <div className="flex items-center gap-0.5" title="Price in SOL">
              <span className="text-slate-500 text-[11px] font-medium">F</span>
              <span className="text-slate-400 text-[11px]">≡</span>
              <span className="font-bold text-slate-100">{solFloorPriceFormatted}</span>
            </div>

            <div className="flex items-center gap-1" title={`${metricWindow} transactions`}>
              <span className="text-slate-500 text-[11px] font-medium">TX</span>
              <span className="font-bold text-slate-100">{liveTxCount ?? '—'}</span>
            </div>

            {buyPct !== null && (
              <span
                role="img"
                aria-label={`${buyPct}% buys`}
                title={`${buyPct}% buys / ${100 - buyPct}% sells`}
                className="discovery-trade-ratio inline-flex w-5 h-1 rounded-sm bg-rose-500 overflow-hidden flex-shrink-0"
              >
                <span style={{ width: `${buyPct}%` }} className="bg-emerald-400 h-full block" />
              </span>
            )}
          </div>
        </div>

        {/* ROW 3: Twitter handle + Follower count */}
        <div className="discovery-card-row-social">
          {twitterHandle ? (
            <>
              <Link
                href={token.twitterUrl || `https://x.com/${twitterHandle.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="truncate text-sky-400 hover:text-sky-300 font-medium"
                title={twitterHandle}
              >
                {twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`}
              </Link>
              {twitterFollowers != null && (
                <span className="inline-flex shrink-0 items-center gap-1 text-sky-400 font-mono text-[11px]" title="X followers · official API">
                  <Users size={11} /> {formatCount(twitterFollowers)}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-600 text-2xs truncate">No social handle verified</span>
          )}
        </div>

        {/* ROW 4: Stats: 👥 holders   🛡️ snipers   🎯 insiders   👑 devRecord   👁️ views ... Quick Buy Button */}
        <div className="discovery-card-row-stats">
          <div className="flex items-center gap-2.5 text-xs font-mono text-slate-300 flex-wrap">
            {/* Holders */}
            <LegendTooltip
              label="Holders"
              definition={`Unique token holders. ${ownershipEvidence ? `Source: ${formatDisplaySource(ownershipEvidence.source)}; ${ownershipEvidence.status}; observed ${ownershipEvidence.observedAt}.` : 'Not measured yet.'}`}
            >
              <span className="discovery-activity-stat inline-flex items-center gap-1">
                <Users size={13} className="text-slate-500" />
                <MetricValue
                  state={toValueState(live?.holdersCount ?? token.holdersCount, { isPending: isAuditLoading, isStale: ownershipEvidence?.status === 'stale', reason: ownershipEvidence?.reason })}
                  label="Holders"
                  format={formatCount}
                />
              </span>
            </LegendTooltip>

            {/* Snipers */}
            <LegendTooltip label="Snipers" definition="Wallets buying in opening blocks or identified sniper bots.">
              <span className="discovery-activity-stat inline-flex items-center gap-1">
                <ShieldCheck size={13} className="text-slate-500" />
                <span>{snipersCountFormatted}</span>
              </span>
            </LegendTooltip>

            {/* Insiders / Target */}
            <LegendTooltip label="Insiders / Top Wallets" definition="Wallets with prior connection to deployer or early funding.">
              <span className="discovery-activity-stat inline-flex items-center gap-1">
                <Target size={13} className="text-slate-500" />
                <span>{insidersCountFormatted}</span>
              </span>
            </LegendTooltip>

            {/* Dev Record */}
            {devRecord && (
              <LegendTooltip label="Deployer record" definition={`${devMigrations} of this creator's ${devMints} reported launches have graduated.`}>
                <span className={`discovery-activity-stat inline-flex items-center gap-1 ${devRateFg}`}>
                  <Crown size={13} />
                  <span>{devRecord}</span>
                </span>
              </LegendTooltip>
            )}

            {/* Viewers */}
            {recentVisitors !== null && (
              <LegendTooltip label="Recent viewers" definition="Measured internal token page views.">
                <span className="discovery-activity-stat inline-flex items-center gap-1 text-slate-400">
                  <Eye size={13} className="text-slate-500" />
                  <span>{formatCount(recentVisitors)}</span>
                </span>
              </LegendTooltip>
            )}
          </div>

          {/* Quick Buy Button on the right */}
          <button
            type="button"
            onClick={(event) => handleTriggerBuy(event, quickBuyPresets[0])}
            disabled={!hasConfirmedVenue}
            className="discovery-quick-buy"
            aria-label={`Quick buy ${token.symbol} for ${quickBuyPresets[0]} ${quickBuyMode.toUpperCase()}`}
            title={hasConfirmedVenue ? 'Open quick buy — review before trading' : 'Quick Buy unavailable until a trading venue is confirmed'}
          >
            <Zap size={12} fill="currentColor" />
            <span>{quickBuyMode === 'sol' ? `${quickBuyPresets[0]} SOL` : `$${quickBuyPresets[0]}`}</span>
          </button>
        </div>

        {/* ROW 5: Audit & Security Pills (Top 10, Dev Holding + Wallet Age, Snipers, Insiders, Bundlers, Dex Paid) */}
        <div className="discovery-card-row-pills">
          <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            <AuditPills
              top10HoldingsPct={top10 ?? undefined}
              devHoldingsPct={devHoldings ?? undefined}
              devWalletAge={devWalletAge ?? undefined}
              sniperPercentage={snipersPct ?? undefined}
              insiderHoldingsPct={insidersPct ?? undefined}
              bundlerPercentage={bundlerPct ?? undefined}
              pending={isAuditLoading}
              evidence={ownershipEvidence}
              alwaysShow
              className="discovery-card-ownership"
            />

            {/* DexScreener Paid / Status pill */}
            {isDexPaid ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-emerald-800/60 bg-emerald-950/60 text-emerald-400 font-mono text-[10px] font-bold">
                🏷️ Paid{dexPaidAge ? ` · ${dexPaidAge}` : ''}
              </span>
            ) : dexPaidAge ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-sky-800/60 bg-sky-950/50 text-sky-400 font-mono text-[10px] font-bold">
                DS ✖ {dexPaidAge}
              </span>
            ) : null}
          </div>

          <div className="discovery-card-tools" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                setShowSafety((open) => !open);
              }}
              aria-expanded={showSafety}
              aria-controls={safetyId}
              aria-label={`Safety details for ${token.symbol}`}
              className={`discovery-icon-button ${showSafety ? 'text-sky-400' : ''}`}
              title="Safety details"
            >
              <ShieldCheck size={14} />
              <ChevronDown size={10} className={showSafety ? 'rotate-180' : ''} />
            </button>
            <button
              type="button"
              onClick={handleToggleWatchlist}
              aria-label="Toggle watchlist"
              aria-pressed={isWatchlisted}
              title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              className={`discovery-icon-button ${isWatchlisted ? 'text-amber-400' : ''}`}
            >
              <Star size={14} fill={isWatchlisted ? 'currentColor' : 'none'} />
            </button>
            <Popover
              trigger={
                <button type="button" className="discovery-icon-button" aria-label={`Token actions for ${token.symbol}`}>
                  <MoreHorizontal size={15} />
                </button>
              }
              className="discovery-actions-popover w-44"
            >
              <div role="menu" aria-label={`Manage ${token.symbol}`} className="flex flex-col">
                <button type="button" role="menuitem" onClick={() => hideToken(token.mint)} className="discovery-action-item">
                  <EyeOff size={14} />Hide token
                </button>
                {devAddress && (
                  <button type="button" role="menuitem" onClick={() => blacklistDev(devAddress)} className="discovery-action-item">
                    <UserX size={14} />Blacklist deployer
                  </button>
                )}
                {twitterHandle && (
                  <button type="button" role="menuitem" onClick={() => muteSocial(twitterHandle)} className="discovery-action-item">
                    <BellOff size={14} />Mute {twitterHandle}
                  </button>
                )}
              </div>
            </Popover>
          </div>
        </div>

        {/* EXPANDABLE SAFETY DETAILS */}
        {showSafety && (
          <div
            id={safetyId}
            role="region"
            aria-label={`Security evidence for ${token.symbol}`}
            className="discovery-card-details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SecurityPills
                isMintRenounced={live?.isMintRenounced ?? token.isMintRenounced}
                isFreezeDisabled={live?.isFreezeDisabled ?? token.isFreezeDisabled}
                isLiquidityLocked={live?.isLiquidityLocked ?? token.isLiquidityLocked}
                lpLockedPct={live?.lpLockedPct}
                evidence={securityEvidence}
                lpEvidence={live?.liquidityEvidence ?? token.liquidityEvidence}
              />
              <RugRiskPill
                risk={rugRisk}
                ownershipEvidence={ownershipEvidence}
                securityEvidence={securityEvidence}
                liquidityEvidence={live?.liquidityEvidence ?? token.liquidityEvidence}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
              <SafetyValue label="Top 10" value={top10} evidence={ownershipEvidence} suffix="%" />
              <SafetyValue label="Developer" value={devHoldings} evidence={ownershipEvidence} suffix="%" />
              <SafetyValue label="Snipers" value={snipersPct} evidence={ownershipEvidence} suffix="%" />
              <SafetyValue label="Insiders" value={insidersPct} evidence={ownershipEvidence} suffix="%" />
              <SafetyValue label="Bundlers" value={bundlerPct} evidence={ownershipEvidence} suffix="%" />
              <SafetyValue label="Fees (USD)" value={feeAccrued === null ? null : Number(feeAccrued)} evidence={marketEvidence} format={formatCompactUSD} />
              <SafetyFlag label="Mint renounced" value={live?.isMintRenounced ?? token.isMintRenounced} evidence={securityEvidence} />
              <SafetyFlag label="Freeze disabled" value={live?.isFreezeDisabled ?? token.isFreezeDisabled} evidence={securityEvidence} />
              <SafetyFlag label="LP locked" value={live?.isLiquidityLocked ?? token.isLiquidityLocked} evidence={live?.liquidityEvidence ?? token.liquidityEvidence ?? securityEvidence} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
