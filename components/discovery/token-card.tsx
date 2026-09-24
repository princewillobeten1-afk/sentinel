'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Star,
  Twitter,
  Search,
  Globe,
  Send,
  EyeOff,
  UserX,
  BellOff,
  Coins,
  CheckCircle2,
  Flame,
  GraduationCap,
  MoreHorizontal,
  ExternalLink,
  Users,
  Trophy,
  Award,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useAppActions } from '@/lib/store';
import { useWatchlist } from '@/lib/store/watchlist-store';
import { useTokenFilters } from '@/lib/store/token-filters-store';
import type { LiveTokenUpdate } from '@/lib/hooks/use-live-token-updates';
import type { DiscoveryToken, TimeWindow, MetricEvidence } from '@/lib/discovery/types';
import {
  resolveLaunchpad,
  LAUNCHPAD_CONFIGS,
  type LaunchpadConfig,
} from '@/lib/market/lifecycle/launchpads';
import { formatCompactUsd, formatTokenPrice, formatCount as formatCountBase, formatBoostCountdown } from '@/lib/discovery/format';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { AuditPills } from '@/components/ui/audit-pills';
import { SecurityPills } from '@/components/ui/security-pills';
import { RugRiskPill } from '@/components/ui/rug-risk-pill';
import { currentRiskRating } from '@/lib/discovery/audit-freshness';
import { MetricValue } from '@/components/ui/metric-value';
import { toValueState } from '@/lib/ui/value-state';
import { mergeTokenCardSnapshot } from '@/lib/discovery/card-snapshot';

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
        title={label} aria-label={label} className="p-0.5 hover:text-sky-400">
        <Icon className="w-2.5 h-2.5" />
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
      label={observed ? `${label} · ${resolvedEvidence?.source} at ${observed}` : label}
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
    ? evidence?.status === 'loading' ? 'pending' : evidence?.status === 'stale' ? 'stale' : 'unknown'
    : evidence?.status === 'stale' ? 'stale' : 'measured';
  const color = state === 'measured' ? 'text-slate-200' : state === 'stale' ? 'text-amber-400' : 'text-slate-500';
  const rendered = state === 'pending' ? '…' : state === 'unknown' ? '—' : `${format(value as number)}${suffix}`;
  return <span className="flex items-center justify-between gap-2"><span className="text-slate-500">{label}</span><span className={`font-mono ${color}`} title={evidence?.reason || evidence?.source}>{rendered}</span></span>;
}

function SafetyFlag({ label, value, evidence }: { label: string; value: boolean | undefined; evidence?: MetricEvidence }) {
  const state = value === undefined ? evidence?.status === 'loading' ? 'pending' : evidence?.status === 'stale' ? 'stale' : 'unknown' : 'measured';
  const rendered = state === 'pending' ? '…' : state === 'unknown' ? '—' : value ? 'Yes' : 'No';
  const color = state === 'measured' ? value ? 'text-emerald-400' : 'text-rose-400' : state === 'stale' ? 'text-amber-400' : 'text-slate-500';
  return <span className="flex items-center justify-between gap-2"><span className="text-slate-500">{label}</span><span className={`font-mono ${color}`} title={evidence?.reason || evidence?.source}>{rendered}</span></span>;
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
  const [showActions, setShowActions] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
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

  // Local live trade & price states updated via WebSocket
  const [livePrice, setLivePrice] = useState<string | undefined>(token.priceUsd);
  useEffect(() => {
    if (!liveMarket?.priceUsd) setLivePrice(token.priceUsd);
  }, [liveMarket?.priceUsd, token.priceUsd]);
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

    if (liveMarket?.priceUsd !== undefined) setLivePrice(String(liveMarket.priceUsd));
    const exactTx = timeWindow === '24h' ? liveMarket?.txCount24h : timeWindow === '1h' ? liveMarket?.txCount1h : liveMarket?.txCount5m;
    const exactBuys = timeWindow === '24h' ? liveMarket?.buysCount24h : timeWindow === '1h' ? liveMarket?.buysCount1h : liveMarket?.buysCount5m;
    const exactSells = timeWindow === '24h' ? liveMarket?.sellsCount24h : timeWindow === '1h' ? liveMarket?.sellsCount1h : liveMarket?.sellsCount5m;
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
  }, [live?.updatedAt, live?.lastTradeSide, live?.lastTradeUpdatedAt, live, liveMarket, timeWindow]);

  const isWatchlisted = checkWatchlisted(token.mint);
  const marketCapUsd = liveMarket?.marketCapUsd ?? token.marketCapUsd;
  const liquidityUsd = liveMarket?.liquidityUsd ?? token.liquidityUsd;

  const handleOpenTrade = () => {
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoURI,
      priceUsd: livePrice || token.priceUsd,
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
      priceUsd: formatSmartPrice(livePrice || token.priceUsd),
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
      price: (livePrice || token.priceUsd),
      mcap: marketCapUsd,
      customAmountSol: quickBuyMode === 'sol' ? amount : undefined,
      customAmountUsd: quickBuyMode === 'usd' ? amount : undefined,
      liquidity: liquidityUsd,
      volume24h: liveMarket?.volume24hUsd ?? token.volume24hUsd,
      priceChange24h: liveMarket?.priceChange24h ?? token.priceChange24h,
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

  // Launchpad Resolution & Profile
  const launchpadConfig: LaunchpadConfig = token.launchpadInfo ?? resolveLaunchpad(token);
  const originLaunchpad = token.originLaunchpad ?? launchpadConfig.name;
  const destinationDex = lifecycle.migratedDex ?? token.launchpadInfo?.destinationDex ?? launchpadConfig.destinationDex;
  const lpStatus = token.lpHandling ?? launchpadConfig.lpHandling;
  const gradTarget = token.graduationTarget ?? launchpadConfig.graduationThreshold;

  // Platform & Protocol label
  const protocolLabel = token.protocol || (launchpadConfig ? launchpadConfig.name : (token.source === 'Pump.fun' ? 'Pump V1' : token.source));
  const isPumpFun = launchpadConfig.id === 'pump.fun';

  const lifecycleState = lifecycle.lifecycleState;
  const isMigrated = lifecycleState === 'migrated' || token.bondingStatus === 'graduated';
  const isMigrating = !isMigrated && (
    lifecycleState === 'migrating' ||
    token.bondingStatus === 'migrating'
  );
  const isNewPair = !isMigrated && !isMigrating;
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
  const volumeDisplay = metricWindow === '1h'
    ? liveMarket?.volume1hUsd ?? token.volume1hUsd
    : metricWindow === '24h'
      ? liveMarket?.volume24hUsd ?? token.volume24hUsd
      : liveMarket?.volume5mUsd ?? token.volume5mUsd;
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

  const selectedPriceChange = metricWindow === '1h'
    ? liveMarket?.priceChange1h ?? token.priceChange1h
    : metricWindow === '24h'
      ? liveMarket?.priceChange24h ?? token.priceChange24h
      : liveMarket?.priceChange5m ?? token.priceChange5m;
  const priceChange = Number.isFinite(selectedPriceChange) ? selectedPriceChange : null;
  const isPositive = priceChange !== null && priceChange >= 0;
  const hasLiquidity = Number.isFinite(Number(liquidityUsd)) && Number(liquidityUsd) > 0;
  const rugRisk = live?.rugRisk ?? token.rugRisk;
  const ownershipEvidence = effectiveEvidence(live?.ownershipEvidence ?? token.ownershipEvidence);
  const isAuditLoading = (live?.auditPending ?? token.auditPending) === true || ownershipEvidence?.status === 'loading';
  const securityEvidence = effectiveEvidence(live?.securityEvidence ?? token.securityEvidence);
  const marketEvidence = effectiveEvidence(liveMarket?.marketEvidence ?? token.marketEvidence);
  const activityEvidence = effectiveEvidence(liveMarket?.activityEvidence ?? token.activityEvidence ?? marketEvidence);
  const migrationSignature = lifecycle.migrationSignature;
  const migratedPool = lifecycle.migratedPool;
  const migratedDex = lifecycle.migratedDex;
  const hasConfirmedVenue = hasLiquidity && Boolean(migratedPool || live?.liquidityPoolAddress || token.liquidityPoolAddress);

  // Filter hidden tokens
  const devAddress = live?.devAddress ?? token.devAddress;
  if (isTokenHidden(token.mint) || isDevBlacklisted(devAddress) || isSocialMuted(twitterHandle)) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      role="link"
      tabIndex={0}
      aria-label={`Trade ${token.symbol}`}
      onClick={handleOpenTrade}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleOpenTrade();
        }
      }}
      className={`discovery-token-card group relative min-w-0 border cursor-pointer select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        flash === 'BUY'
          ? 'bg-emerald-950/40 border border-emerald-700'
          : flash === 'SELL'
            ? 'bg-rose-950/40 border border-rose-700'
            : 'bg-slate-950 border-transparent border-b-slate-800 hover:bg-slate-900'
      }`}
    >
      <div className="discovery-card-actions absolute right-2 bottom-2 z-20">
        <button
          type="button"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowActions((open) => !open); }}
          aria-label={`Token actions for ${token.symbol}`}
          aria-haspopup="menu"
          aria-expanded={showActions}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900/95 text-slate-400 hover:border-slate-600 hover:text-slate-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {showActions && (
          <div role="menu" aria-label={`Manage ${token.symbol}`} onClick={(event) => event.stopPropagation()} className="absolute right-0 bottom-full mb-1 w-44 overflow-hidden rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl">
            <button type="button" role="menuitem" onClick={() => hideToken(token.mint)} className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[11px] text-slate-300 hover:bg-slate-800">
              <EyeOff className="h-3.5 w-3.5" /> Hide token
            </button>
            {devAddress && (
              <button type="button" role="menuitem" onClick={() => blacklistDev(devAddress)} className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[11px] text-slate-300 hover:bg-slate-800 hover:text-rose-300">
                <UserX className="h-3.5 w-3.5" /> Blacklist deployer
              </button>
            )}
            {twitterHandle && (
              <button type="button" role="menuitem" onClick={() => muteSocial(twitterHandle)} className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[11px] text-slate-300 hover:bg-slate-800 hover:text-amber-300">
                <BellOff className="h-3.5 w-3.5" /> Mute {twitterHandle}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 1 — Identity: avatar, symbol/name, price and change */}
      <div className="discovery-card-identity flex items-start gap-2">
        <TokenAvatar
          src={token.logoURI}
          symbol={token.symbol}
          name={token.name}
          mint={token.mint}
          size="lg"
          dexBadge={token.source}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-100 truncate max-w-[92px]">{token.symbol}</span>
            <span className="text-2xs text-slate-500 truncate max-w-[86px]" title={token.name}>{token.name}</span>
            {token.hasDeceptiveName && (
              <LegendTooltip
                label="Deceptive name"
                definition="This token's name or symbol contained invisible Unicode — bidi overrides or zero-width characters — which can make it display as a different, legitimate token. The characters have been removed for display."
              >
                <span className="shrink-0 px-1 rounded bg-rose-950/60 border border-rose-800 text-[9px] font-bold text-rose-400">
                  ⚠ NAME
                </span>
              </LegendTooltip>
            )}
            {(token.duplicateCount ?? 1) > 1 && (
              <LegendTooltip
                label="Duplicate launches"
                definition={`${token.duplicateCount} tokens launched together with this name and symbol. The most liquid is shown.`}
              >
                <span className="shrink-0 px-1 rounded bg-amber-950/60 border border-amber-900/60 text-[9px] font-mono font-bold text-amber-400">
                  ×{token.duplicateCount}
                </span>
              </LegendTooltip>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-[3px]">
              <span title={migrationAgeMinutes !== null ? `Since confirmed migration; token launched ${token.ageFormatted || formatLiveAge(token.ageMinutes, elapsedSec)}` : protocolLabel} className="font-numeric text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              {isMigrated && <GraduationCap className="w-3 h-3 text-purple-400 inline shrink-0" />}
                {formatLiveAge(migrationAgeMinutes ?? token.ageMinutes, migrationAgeMinutes === null ? elapsedSec : 0)}
            </span>
            <button
              onClick={handleCopyAddress}
              title={copied ? 'Copied' : 'Copy contract address'}
              className="font-numeric text-[10px] text-slate-500 hover:text-sky-300 transition-colors"
            >
              {copied ? 'copied' : shortMint}
            </button>
            <span className={`discovery-card-protocol text-[9px] px-1 rounded-[3px] border ${launchpadConfig.badgeBg} ${launchpadConfig.badgeBorder} ${launchpadConfig.badgeText}`}>
              {protocolLabel}
            </span>
          </div>
          <CardSocialLinks token={token} />
        </div>

        <button
          onClick={handleToggleWatchlist}
          title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          aria-label="Toggle watchlist"
          className={`shrink-0 p-1 rounded-md border transition-all ${
            isWatchlisted
              ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
              : 'text-slate-600 hover:text-amber-400 border-transparent'
          }`}
        >
          <Star className={`w-3 h-3 ${isWatchlisted ? 'fill-amber-400' : ''}`} />
        </button>
      </div>

      {/* 2 — Where it is on its way to a pool. */}
      <div className="discovery-card-lifecycle">
      {isMigrated ? (
        <LegendTooltip
          className="w-full"
          label="Migrated"
          definition={
            destinationDex
              ? `Liquidity migrated from ${originLaunchpad} to ${destinationDex}${migratedPool ? ` — pool ${migratedPool.slice(0, 8)}…` : ''}. ${lpStatus}. Confirmed on-chain.`
              : 'Moved to an AMM pool. Confirmed from the on-chain migration transaction.'
          }
        >
          <div
            className="w-full flex items-center justify-between gap-1.5"
            title={migrationSignature ? `Migration tx ${migrationSignature}` : undefined}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className={`text-[8.5px] font-bold px-1 py-0.5 rounded border truncate ${launchpadConfig.badgeBg} ${launchpadConfig.badgeBorder} ${launchpadConfig.badgeText}`}>
                {originLaunchpad}
              </span>
              <span className="text-[10px] font-bold text-emerald-400 truncate">
                {destinationDex}
              </span>
              <span className="text-[8.5px] text-emerald-300/90 font-mono bg-emerald-950/70 border border-emerald-800/60 px-1 py-0.5 rounded shrink-0">
                {lpStatus}
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {migrationSignature && (
                <Link
                  href={`https://solscan.io/tx/${migrationSignature}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Verify migration transaction on Solscan"
                  className="text-emerald-400 hover:text-emerald-200"
                >
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {migratedPool && (
                <Link
                  href={`https://solscan.io/account/${migratedPool}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="font-numeric text-[9px] text-slate-400 hover:text-slate-200 font-mono"
                >
                  {migratedPool.slice(0, 4)}…{migratedPool.slice(-4)}
                </Link>
              )}
            </span>
          </div>
        </LegendTooltip>
      ) : isMigrating ? (
        <LegendTooltip
          className="w-full"
          label="Migrating"
          definition={`${originLaunchpad} bonding curve complete. Currently migrating liquidity to ${destinationDex} (${lpStatus}).`}
        >
          <div className="w-full flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className={`text-[8.5px] font-bold px-1 py-0.5 rounded border truncate ${launchpadConfig.badgeBg} ${launchpadConfig.badgeBorder} ${launchpadConfig.badgeText}`}>
                {originLaunchpad}
              </span>
              <span className="text-[9.5px] font-semibold text-amber-300 truncate">
                Migrating → {destinationDex}
              </span>
            </div>
            <span className="text-[9px] font-mono text-amber-400 font-bold shrink-0">
              100%
            </span>
          </div>
        </LegendTooltip>
      ) : (
        curvePct !== null && (
          <LegendTooltip
            label={`${launchpadConfig.name} bonding curve`}
            definition={`Real completion for ${launchpadConfig.name} (${launchpadConfig.curveType}). Target graduation threshold: ${gradTarget} to migrate LP to ${launchpadConfig.destinationDex} (${launchpadConfig.lpHandling}).`}
            className="w-full"
          >
            <div className="w-full">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1 min-w-0">
                  <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span className={`text-[8px] font-bold px-1 py-px rounded border truncate ${launchpadConfig.badgeBg} ${launchpadConfig.badgeBorder} ${launchpadConfig.badgeText}`}>
                    {launchpadConfig.name}
                  </span>
                  <span className="text-[8.5px] text-slate-400 truncate">
                    → {launchpadConfig.destinationDex}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[8.5px] text-slate-400 font-mono" title={`Graduation Target: ${gradTarget}`}>
                    {gradTarget}
                  </span>
                  <span className="font-numeric text-[9px] font-bold text-slate-100">{curvePct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(1, curvePct))}%` }}
                />
              </div>
            </div>
          </LegendTooltip>
        )
      )}
      </div>
      {/* 3 — Market figures */}
      <div className="discovery-metrics grid grid-cols-2 gap-x-2">
        <div className="col-span-2 flex items-center justify-end gap-2">
          <CardMetric label="Token price" value={livePrice || token.priceUsd} evidence={marketEvidence} format={(value) => formatSmartPrice(value)} className="font-numeric text-[11px] text-slate-100" />
          <span className={`font-numeric text-[10px] font-bold ${priceChange === null ? 'text-slate-500' : isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {priceChange === null ? '—' : `${isPositive ? '+' : ''}${priceChange.toFixed(1)}%`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">MC</span>
          <CardMetric label="Market cap" value={marketCapUsd} evidence={marketEvidence} format={(value) => formatCompactUSD(value)} className="font-numeric text-[10px] text-amber-400" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">VOL</span>
          <CardMetric label={`${metricWindow} volume`} value={volumeDisplay} evidence={metricWindow === '5m' ? activityEvidence : marketEvidence} format={(value) => formatCompactUSD(value)} className="font-numeric text-[10px] text-slate-300" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">LIQ</span>
          <CardMetric label="Liquidity" value={liquidityUsd} evidence={marketEvidence} format={(value) => formatCompactUSD(value)} className="font-numeric text-[10px] text-sky-400" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-slate-500">TX</span>
          <span className="inline-flex items-center font-numeric text-[10px] font-semibold text-slate-300">
            <CardMetric label={`${metricWindow} transactions`} value={liveTxCount} evidence={metricWindow === '5m' ? activityEvidence : marketEvidence} format={formatCount} />
            {buyPct !== null && <span role="img" aria-label={`${buyPct}% buys`} title={`${buyPct}% buys / ${100 - buyPct}% sells`}
              className="ml-1 inline-flex h-0.5 w-4 shrink-0 overflow-hidden bg-rose-400">
              <span className="h-full bg-emerald-400" style={{ width: `${buyPct}%` }} />
            </span>}
          </span>
        </div>
      </div>

      {/* 4 — Ownership audit. Unmeasured renders neutral grey, never green. */}
      <AuditPills
        top10HoldingsPct={top10 ?? undefined}
        devHoldingsPct={devHoldings ?? undefined}
        devWalletAge={devWalletAge ?? undefined}
        sniperPercentage={snipersPct ?? undefined}
        insiderHoldingsPct={insidersPct ?? undefined}
        bundlerPercentage={bundlerPct ?? undefined}
        pending={(live?.auditPending ?? token.auditPending) === true || ownershipEvidence?.status === 'loading'}
        evidence={ownershipEvidence}
        alwaysShow
        className="discovery-card-ownership"
      />

      <button
        type="button"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowSafety((open) => !open); }}
        aria-expanded={showSafety}
        className="flex w-full items-center justify-between border-t border-slate-800/70 pt-1 text-left text-[9px] font-semibold text-slate-400 hover:text-slate-200"
      >
        <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5 text-sky-400" /> Safety details</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${showSafety ? 'rotate-180' : ''}`} />
      </button>

      {showSafety && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-slate-800 bg-slate-900/70 p-2 text-[9px]" onClick={(event) => event.stopPropagation()}>
          <SafetyValue label="Holders" value={live?.holdersCount ?? token.holdersCount} evidence={ownershipEvidence} format={formatCount} />
          <SafetyValue label="Top 10" value={top10} evidence={ownershipEvidence} suffix="%" />
          <SafetyValue label="Developer" value={devHoldings} evidence={ownershipEvidence} suffix="%" />
          <SafetyValue label="Insiders" value={insidersPct} evidence={ownershipEvidence} suffix="%" />
          <SafetyValue label="Snipers" value={snipersPct} evidence={ownershipEvidence} suffix="%" />
          <SafetyValue label="Bundled" value={bundlerPct} evidence={ownershipEvidence} suffix="%" />
          <SafetyFlag label="LP locked" value={live?.isLiquidityLocked ?? token.isLiquidityLocked} evidence={securityEvidence} />
          <SafetyFlag label="Mint renounced" value={live?.isMintRenounced ?? token.isMintRenounced} evidence={securityEvidence} />
          <SafetyFlag label="Freeze disabled" value={live?.isFreezeDisabled ?? token.isFreezeDisabled} evidence={securityEvidence} />
          <SafetyValue label="Risk score" value={live?.rugRisk?.score ?? token.rugRisk?.score} evidence={securityEvidence} />
        </div>
      )}

      <div className="discovery-card-evidence">
      <div className="flex flex-wrap items-center gap-1 font-mono text-[9px]">
        <LegendTooltip label="Holders" definition={`Unique holders reported by the ownership provider. ${ownershipEvidence ? `Source: ${ownershipEvidence.source}; ${ownershipEvidence.status}; observed ${ownershipEvidence.observedAt}.` : 'Not measured yet.'}`}>
          <span className="flex items-center gap-1 text-slate-300">
            <Users className="h-2.5 w-2.5 text-slate-500" />
            <MetricValue state={toValueState(live?.holdersCount ?? token.holdersCount, { isPending: isAuditLoading, isStale: ownershipEvidence?.status === 'stale', reason: ownershipEvidence?.reason })} label="Holder count" format={formatCount} />
          </span>
        </LegendTooltip>
        <LegendTooltip label="Pro traders" definition="Wallets classified as smart traders by Birdeye Holder Profile; classification is heuristic and time-stamped.">
          <span className="flex items-center gap-1 text-slate-300">
            <Trophy className="h-2.5 w-2.5 text-amber-400" />
            <MetricValue state={toValueState(proTraders, { isPending: isAuditLoading, isStale: ownershipEvidence?.status === 'stale', reason: ownershipEvidence?.reason })} label="Pro traders" format={formatCount} />
          </span>
        </LegendTooltip>
        <LegendTooltip label="KOL wallets" definition="Known influencer wallets classified by Birdeye Holder Profile; classification is heuristic and time-stamped.">
          <span className="flex items-center gap-1 text-slate-300">
            <Award className="h-2.5 w-2.5 text-purple-400" />
            <MetricValue state={toValueState(kols, { isPending: isAuditLoading, isStale: ownershipEvidence?.status === 'stale', reason: ownershipEvidence?.reason })} label="KOL wallets" format={formatCount} />
          </span>
        </LegendTooltip>
      </div>

      <SecurityPills
        isMintRenounced={live?.isMintRenounced ?? token.isMintRenounced}
        isFreezeDisabled={live?.isFreezeDisabled ?? token.isFreezeDisabled}
        isLiquidityLocked={live?.isLiquidityLocked ?? token.isLiquidityLocked}
        lpLockedPct={live?.lpLockedPct}
        evidence={securityEvidence}
        lpEvidence={live?.liquidityEvidence ?? token.liquidityEvidence}
        compact
      />

      <RugRiskPill risk={rugRisk} ownershipEvidence={ownershipEvidence} securityEvidence={securityEvidence} liquidityEvidence={live?.liquidityEvidence ?? token.liquidityEvidence} />

      </div>
      {/* 5 — Deployer record, promotion, socials, and the trade action */}
      <div className="discovery-card-footer flex items-center gap-1.5">
        {devRecord && (
          <LegendTooltip
            label="Deployer record"
            definition={`${devMigrations} of this creator's ${devMints} reported launches have graduated. This record alone does not establish intent or predict a rug.`}
          >
            <span className="flex items-center gap-1">
              <span className="sr-only">graduated</span>
              <span className={`font-numeric text-[9px] font-bold ${devRateFg}`}>{devRecord}</span>
            </span>
          </LegendTooltip>
        )}

        {isDexPaid && (
          <LegendTooltip
            label="Dex Paid"
            definition="The team paid DexScreener for an approved token profile. Separate from a boost, which is paid promotion."
          >
            <span className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-500/15 border border-amber-500/40 text-[9px] font-bold text-amber-400">
              <Coins className="w-2.5 h-2.5" />
              DS{dexPaidAge ? ` ${dexPaidAge}` : ''}
            </span>
          </LegendTooltip>
        )}

        {(live?.isBoosted ?? token.isBoosted) && (
          <LegendTooltip
            label="Boost"
            definition="A paid promotion is active on DexScreener. The amount is what the team spent; DexScreener publishes no expiry, so no countdown is shown."
          >
            <span className="flex items-center gap-0.5 px-1 py-px rounded bg-amber-400/15 border border-amber-400/50 text-[9px] font-bold text-amber-400">
              <Flame className="w-2.5 h-2.5 fill-current" />
              {formattedBoost ?? ((live?.boostAmount ?? token.boostAmount) !== undefined ? `×${formatCount(live?.boostAmount ?? token.boostAmount)}` : 'Boost')}
            </span>
          </LegendTooltip>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => handleTriggerBuy(e, quickBuyPresets[0])}
            disabled={!hasConfirmedVenue}
            className="min-h-8 font-numeric text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-[3px] rounded-[5px] hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-400 transition-colors disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
            title={hasConfirmedVenue ? 'Open quick buy' : 'Quick Buy unavailable until a liquidity pool is confirmed'}
          >
            BUY {quickBuyMode === 'sol' ? quickBuyPresets[0] : `$${quickBuyPresets[0]}`}
          </button>
        </div>
      </div>
    </div>
  );
});
