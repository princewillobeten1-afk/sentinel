'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Target,
  Users,
  Award,
  Code2,
  Zap,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Maximize2,
  Minimize2,
  Flame,
  Check,
  Search,
  Lock,
  Percent,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Wallet,
  Settings2,
  ArrowRight,
  X,
  Activity,
  Droplets,
  Network,
  Globe,
  Share2,
  Layers,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuditPills } from '@/components/ui/audit-pills';
import { RugRiskPill } from '@/components/ui/rug-risk-pill';
import { useTokenAudit } from '@/lib/hooks/use-token-audit';
import { OpenOrdersDashboard } from '@/components/limit-orders/open-orders-dashboard';
import { useAppState, useAppActions } from '@/lib/store';
import { useSentinelWS } from '@/lib/hooks/use-sentinel-ws';

export type AxiomTabType =
  | 'trades'
  | 'positions'
  | 'orders'
  | 'dev-activity'
  | 'maps'
  | 'liquidity'
  | 'audit'
  | 'holders'
  | 'top-traders'
  | 'dev-tokens';

export interface TradeTransaction {
  id: string;
  type: 'buy' | 'sell';
  amountSol: string;
  tokens: string;
  price: string;
  valueUsd: string;
  time: string;
  wallet: string;
  /**
   * `null` while a submitted trade has no confirmed signature yet.
   *
   * This was a required string, which is why the execution path invented one
   * ('5x' + random) rather than leave it empty — a fake hash reads as a settled
   * on-chain trade. Nullable lets the row say "pending confirmation" instead.
   */
  txHash: string | null;
  isWhale?: boolean;
  /** ISO time of the trade, so the Age column keeps counting. */
  timestamp?: string;
  /** Unshortened maker address, for copy. */
  fullWallet?: string;
}

export interface DevActivityEvent {
  id: string;
  type: 'buy' | 'sell' | 'lp_add' | 'burn' | 'mint' | 'transfer';
  label: string;
  amountSol?: string;
  tokens: string;
  price?: string;
  valueUsd: string;
  impact?: string;
  devBalanceAfter: string;
  devSupplyPct: string;
  time: string;
  txHash: string;
}

export interface LiquidityPoolItem {
  id: string;
  dex: string;
  pair: string;
  poolAddress: string;
  liquidityUsd: string;
  reserves: {
    sol: string;
    token: string;
  };
  volume24h: string;
  fees24h: string;
  apy: string;
  lockStatus: 'burned' | 'locked' | 'unlocked';
  lockDetails: string;
  feeTier: string;
}

export interface LiquidityProvider {
  rank: number;
  provider: string;
  tag: string;
  pool: string;
  lpTokens: string;
  sharePct: string;
  valueUsd: string;
  lockStatus: 'Burned 🔥' | 'Locked 🔒' | 'Unlocked ⚠️';
  lockExpiry?: string;
}

export interface MapClusterNode {
  id: string;
  label: string;
  // `/bubble-map` only ever distinguishes a pool account from any other
  // holder -- see the legend fix above. `dev`/`whale`/`insider`/`sniper`
  // were never actually assigned by the backend.
  tag: 'dex' | 'holder';
  address: string;
  balanceTokens: string;
  supplyPct: number | null;
  /** Always null: this endpoint reads balances, not prices. */
  valueUsd: string | null;
  x: number;
  y: number;
  r: number;
  /** Always null: funding relationships between wallets are not mapped. */
  fundingSource: string | null;
  color: string;
  borderColor: string;
}

export interface AxiomChartTabsProps {
  currentPrice?: number;
  tokenSymbol?: string;
  tokenMint?: string;
  onOpenLimitBuilder?: () => void;
  onQuickTrade?: (type: 'buy' | 'sell', solAmount: number) => void;
}

/** Seconds, minutes, hours or days since `iso` — the tape's Age column. */
function tapeAge(iso: string | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function tapeCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (a >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  // A fraction of a high-priced token is still a real position: 0.004 ORE was
  // rounding to `0` next to its own $0.34 value.
  if (a === 0) return '0';
  if (a >= 0.0001) return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return n > 0 ? '<0.0001' : '>-0.0001';
}

function tapePrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n >= 1 ? `$${n.toFixed(4)}` : `$${n.toPrecision(4)}`;
}

/**
 * USD, with enough precision to stay true at dust size.
 *
 * Two decimals turned a real $0.0000017 trade into `$0`, which reads as
 * missing data rather than as the dust it is.
 */
function tapeUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '$0';
  if (a >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (a >= 0.01) return `$${n.toFixed(4)}`;
  if (a >= 0.000001) return `$${n.toFixed(8).replace(/0+$/, '')}`;
  return n > 0 ? '<$0.000001' : '>-$0.000001';
}

/** SOL, same principle: a 0.000000017 SOL leg is not `0.0000`. */
function tapeSol(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 1) return n.toFixed(2);
  if (a >= 0.0001) return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return n > 0 ? '<0.0001' : '>-0.0001';
}

/**
 * One tape row from a `/live-trades` trade or a `token.trade` push.
 *
 * Every field is what the source measured or a dash. The push handler this
 * replaced filled the gaps: SOL from USD at a hardcoded $150, `0.5` SOL when
 * nothing was known, `'1,000'` tokens, and a maker named `'anon...4kL2'`.
 */
function tapeRow(t: {
  eventId?: string;
  signature: string;
  side?: string;
  wallet?: string | null;
  amountUsd?: number | string | null;
  amountSol?: number | string | null;
  amountTokens?: number | string | null;
  priceUsd?: number | string | null;
  timestamp?: string;
}): TradeTransaction {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const sol = num(t.amountSol);
  const usd = num(t.amountUsd);
  const tokens = num(t.amountTokens);
  const price = num(t.priceUsd);
  const side = String(t.side ?? '').toUpperCase();
  // Jupiter omits a price on trades its own price feed will not vouch for,
  // which left most rows showing a dash. USD over tokens is not a guess at the
  // market price — it is what this trade executed at, from two measured legs.
  const executed = price !== null && price > 0
    ? price
    : usd !== null && tokens !== null && usd > 0 && tokens > 0
      ? usd / tokens
      : null;
  return {
    id: t.eventId ?? `${t.signature}:${side}`,
    type: side === 'SELL' ? 'sell' : 'buy',
    amountSol: sol === null ? '—' : tapeSol(sol),
    tokens: tokens === null ? '—' : tapeCompact(tokens),
    price: executed === null ? '—' : tapePrice(executed),
    valueUsd: tapeUsd(usd),
    time: tapeAge(t.timestamp),
    timestamp: t.timestamp,
    wallet: t.wallet ? `${t.wallet.slice(0, 4)}...${t.wallet.slice(-4)}` : '—',
    fullWallet: t.wallet ?? undefined,
    txHash: t.signature,
    // The filter is labelled ">5 SOL"; it was testing $5,000.
    isWhale: sol !== null && sol >= 5,
  };
}

export function AxiomChartTabs({
  currentPrice = 142.5,
  tokenSymbol = 'SOL',
  tokenMint = 'So11111111111111111111111111111111111111112',
  onOpenLimitBuilder,
  onQuickTrade,
}: AxiomChartTabsProps) {
  const { connectedWallet, primaryWallet } = useAppState();
  const { addNotification, addExecutionLog, setQuickBuyOpen, setWalletModalOpen } = useAppActions();

  const activeWallet = primaryWallet || connectedWallet;

  // Safe sanitized token and price calculations
  const safeSymbol = tokenSymbol?.trim() && tokenSymbol !== '$' ? tokenSymbol.replace(/^\$/, '') : 'SOL';
  const safeMint = tokenMint || 'So11111111111111111111111111111111111111112';
  const safePrice = typeof currentPrice === 'number' && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 142.5;
  const safePriceFormatted = safePrice < 0.0001 ? `$0.0₄${(safePrice * 10000).toFixed(2)}` : safePrice < 0.01 ? `$${safePrice.toFixed(4)}` : `$${safePrice.toFixed(4)}`;

  const [activeTab, setActiveTab] = useState<AxiomTabType>('trades');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'SOL'>('USD');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'buy' | 'sell' | 'whale'>('all');
  const [devFilter, setDevFilter] = useState<'all' | 'buy' | 'sell' | 'lp'>('all');
  const [tradeSearch, setTradeSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Total liquidity for the tab badge.
   *
   * Seeded '$561K' for every token, then overwritten with the endpoint's raw
   * number — which rendered as "Liquidity (795318.3507655672)". Starts unknown
   * and is formatted on arrival.
   */
  const [totalLiquidityDisplay, setTotalLiquidityDisplay] = useState<string | null>(null);
  /**
   * Holder count for the tab badge.
   *
   * Seeded '1.4K' for every token — the badge read "Holders (1.4K)" whether the
   * token had a million holders or none, and the label never updated because
   * `getTokenLargestAccounts` caps at 20 and cannot supply a total.
   */
  const [holdersDisplay, setHoldersDisplay] = useState<string | null>(null);
  /** Real top-10 share for the Holders header, which read a fixed 24.50%. */
  const [holdersTop10Pct, setHoldersTop10Pct] = useState<number | null>(null);
  /**
   * Deployer profile, from `/dev-activity`.
   *
   * Seeded previously with a complete fiction: creator `7xK9...3a19`, holding
   * 0.85% of supply (the source of the "0.85% Dev" badge in the tab strip),
   * `isVerified: true`, realised profit of +$48,250, and a `dumpRiskRating` of
   * "LOW" — a risk verdict asserted for every token without anything being
   * checked.
   *
   * Every field is nullable now. Jupiter supplies the creator address and its
   * mint history; supply share and realised profit need a per-wallet balance
   * and cost basis nothing computes, so they stay null and render as unknown.
   */
  const [devProfile, setDevProfile] = useState<{
    creatorWallet: string | null;
    devMints: number | null;
    devMigrations: number | null;
    migrationRatePct: number | null;
    mintAuthorityDisabled: boolean | null;
    freezeAuthorityDisabled: boolean | null;
    currentHoldingSupplyPct: number | null;
  }>({
    creatorWallet: null,
    devMints: null,
    devMigrations: null,
    migrationRatePct: null,
    mintAuthorityDisabled: null,
    freezeAuthorityDisabled: null,
    currentHoldingSupplyPct: null,
  });

  /**
   * Token Audit tab, from `/audit`.
   *
   * The whole tab used to be four tiles and a security checklist with fixed
   * values -- a 14/100 risk score, "24.5% Cluster Top 10", "92.4% Authentic",
   * "0/12 Rugged", mint/freeze authority and LP burn all asserted `true` -- for
   * every token, and the tab never actually called this endpoint. Every field
   * here starts unknown and is filled only by what `/audit` measured.
   */
  const { data: auditData, error: auditError, refreshing: auditRefreshing, refresh: refreshAudit } = useTokenAudit(safeMint, activeTab === 'audit');

  // Selected Map Node for Bubble Map Inspector
  const [selectedMapNode, setSelectedMapNode] = useState<MapClusterNode | null>(null);

  /**
   * Instant Trade popout.
   *
   * Was an always-open full-width bar wedged between the chart and the tab
   * strip, so every amount preset, the slippage control, the MEV toggle and
   * both trade buttons were permanently on screen competing with the chart.
   * It is a fast-action surface, not a fixture: closed by default, opened from
   * the toolbar button, dismissed with Escape or a click outside.
   */
  const [showInstantTrade, setShowInstantTrade] = useState(false);
  const [instantTradeSide, setInstantTradeSide] = useState<'buy' | 'sell'>('buy');
  const [instantSolAmount, setInstantSolAmount] = useState('0.5');
  const [instantSlippage, setInstantSlippage] = useState('1.0');
  const [isInstantBuying, setIsInstantBuying] = useState(false);
  const [isInstantSelling, setIsInstantSelling] = useState(false);
  const [instantTradeSuccess, setInstantTradeSuccess] = useState<string | null>(null);
  /**
   * Canonical SOL price, for the pre-quote estimate only.
   *
   * Null until it loads, and null renders as `—`. It replaces a hardcoded
   * 150.0 that disagreed with every other SOL price in the app.
   */
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    // `/analytics/market` never returned a SOL price, so this estimate never
    // loaded. The live summary serves the same canonical price as the status bar.
    fetch('/api/v1/market/live/summary', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const price = j?.data?.summary?.solPriceUsd;
        if (alive && Number.isFinite(Number(price))) setSolPriceUsd(Number(price));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  /** Why the last quote attempt failed. A failure is shown, never swallowed. */
  const [instantTradeError, setInstantTradeError] = useState<string | null>(null);
  /**
   * The last real quote. Not an execution — the swap exists only once signed.
   */
  const [instantQuote, setInstantQuote] = useState<{
    side: 'buy' | 'sell';
    summary: string;
    minimumReceived: string;
    route: string;
    impact: string;
  } | null>(null);
  /** Exit fractions offered on the instant panel. */
  const SELL_PRESETS = [10, 25, 50, 100] as const;
  const [sellPercent, setSellPercent] = useState<number>(50);
  const [customSellPercent, setCustomSellPercent] = useState('');
  /** What a sell would actually use — the typed value wins when present. */
  const effectiveSellPercent = customSellPercent
    ? Math.min(100, Math.max(0, Number(customSellPercent) || 0))
    : sellPercent;

  /**
   * The trade tape starts empty and is filled by `/live-trades`.
   *
   * It was seeded with eight fabricated trades — `$0.0425` from wallets like
   * `4zW8...9kL2` with signatures such as `5xQ98j1k2mP3` — which rendered on
   * first paint for every token and stayed on screen whenever the fetch failed.
   * "Rich initial fallbacks" is the same defect as a mock: an empty tape that
   * fills is honest, a fictional one is not.
   */
  const [trades, setTrades] = useState<TradeTransaction[]>([]);
  /** Distinguishes "still loading" and "failed" from a token with no trades. */
  const [tradesState, setTradesState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [tradesCoverage, setTradesCoverage] = useState<string | null>(null);
  /**
   * Ordering guards for the tape.
   *
   * `tradesRequestRef` numbers each request and `tradesAppliedRef` records the
   * newest one whose rows reached the screen, so a slow response is dropped
   * only when fresher rows are already shown. Discarding it merely because a
   * newer request had *started* left the tape stuck on "Loading": the poll
   * fires every 5s and a request can take longer than that, so every response
   * arrived with a newer one in flight and none was ever applied.
   *
   * `tradesInFlightRef` keeps the poll from stacking requests on a slow feed.
   */
  const tradesRequestRef = useRef(0);
  const tradesAppliedRef = useRef(0);
  const tradesInFlightRef = useRef(false);
  const [topTradersMeta, setTopTradersMeta] = useState<{ trades: number } | null>(null);

  /**
   * Filled by `/dev-activity`, which now returns the deployer's real mint
   * history and no timeline.
   *
   * These were seeded with invented events — "Dev Accumulation Buy +15.00 SOL"
   * with an impact of "+1.8% Pump" — shown for every token. Reconstructing a
   * deployer's buys and sells needs a signature-history walk nothing performs,
   * so an empty list is the truthful state.
   */
  const [devActivities, setDevActivities] = useState<DevActivityEvent[]>([]);

  /**
   * Filled by `/bubble-map`, which now derives nodes from chain state.
   *
   * The seed was a fixed picture for every token: a "Raydium CPMM Pool" at
   * address 5xRydm99qP88x12kL0z1 holding 18.42%, a "Dev Creator Wallet" at
   * 0.85%, and retail at 67.21% — the same split on Wrapped SOL as on a token
   * minted a minute earlier.
   */
  const [mapClusterNodes, setMapClusterNodes] = useState<MapClusterNode[]>([]);

  /**
   * The Maps tab's stats bar, from the same `/bubble-map` call above.
   *
   * The bar over it read "89/100 (Safe)" Decentralization Health, "2 Wallets
   * (0.85%)" Dev Connected Wallets and "2.94% (4 Wallets)" Sniper Supply for
   * every token -- none of that is measured anywhere in this platform. Only
   * top-10 concentration is real; the rest stays null rather than invented.
   */
  const [mapTop10ConcentrationPct, setMapTop10ConcentrationPct] = useState<number | null>(null);

  /**
   * Starts empty and is filled by `/liquidity`.
   *
   * These were seeded with two fictional pools — "Raydium CPMM" at address
   * 5xRydm99qP88x12kL0z1 holding $384,500 with a 142.8% APY and "100% LP
   * Burned" — shown for every token including ones with no pool at all. The
   * endpoint no longer returns a per-pool breakdown, because enumerating pools
   * needs a query it does not perform.
   */
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPoolItem[]>([]);

  /**
   * Top LP providers table.
   *
   * Was seeded with four fictional rows for every token: "Solana Incinerator"
   * holding 85.2% "Burned", a "Raydium Protocol Vault", a "Streamflow Lock
   * Vault" with "342 days remaining", all denominated in the same nonexistent
   * $SENT pair the rest of this file has been cleaned of. `/liquidity`
   * deliberately returns no per-provider breakdown -- enumerating LP holders
   * needs a query this platform does not perform -- so this starts empty and
   * the tab says so, rather than falling back to the fiction it used to hold.
   */
  const topLiquidityProviders: LiquidityProvider[] = [];

  /**
   * Holders and top traders start empty and are filled by their endpoints.
   *
   * They were seeded with a fabricated cap table — "Raydium CPMM Pool 18.42%",
   * "Dev Creator (Vested) 8.00%", named whales with exact balances — rendered
   * identically for every token, including tokens with no holders at all. An
   * empty list that fills in is honest; a fictional one that never clears is
   * not.
   */
  const [topHolders, setTopHolders] = useState<any[]>([]);
  const [topTraders, setTopTraders] = useState<any[]>([]);

  // Dev Tokens History
  /**
   * Deployer's launch history.
   *
   * Was a hardcoded object: creator `7xK9...3a19`, "98/100 (Tier 1 Verified)",
   * and four invented launches led by `$SENT "Solana Sentinel"` — rendered on
   * every token page including Wrapped SOL.
   *
   * `/dev-activity` returns the real creator plus `devMints` and
   * `devMigrations`. A per-launch timeline needs a signature-history walk that
   * nothing performs, so `recentLaunches` stays empty and the panel says so
   * rather than listing tokens that do not exist.
   */
  const devHistory = {
    creator: devProfile.creatorWallet,
    totalCreated: devProfile.devMints,
    migratedCount: devProfile.devMigrations,
    migrationRatePct: devProfile.migrationRatePct,
    recentLaunches: [] as Array<{
      symbol: string;
      name: string;
      launchDate: string;
      athMarketCap?: string;
      status?: string;
      rugRisk?: string;
    }>,
  };

  // ---------------------------------------------------------------------------
  // LIVE WEBSOCKET DATA: Stream Incoming Trades via internal Sentinel WS
  // ---------------------------------------------------------------------------
  useSentinelWS(safeMint ? [`token.trade:${safeMint}`, `token.price:${safeMint}`] : [], (data, msg) => {
    if (msg.topic !== `token.trade:${safeMint}` || !data?.signature) return;
    // On this topic `amount` is the trade's USD value (see the broadcaster's
    // payload), so tokens are derived from it and the price, not read from it.
    const usd = data.amount === undefined || data.amount === null ? null : Number(data.amount);
    const price = data.priceUsd === undefined || data.priceUsd === null ? null : Number(data.priceUsd);
    const row = tapeRow({
      signature: data.signature,
      side: data.side ?? data.type,
      wallet: data.wallet ?? null,
      amountUsd: usd,
      amountSol: data.amountSol ?? null,
      amountTokens: usd !== null && price ? usd / price : null,
      priceUsd: price,
      timestamp: new Date(data.timestamp ?? Date.now()).toISOString(),
    });
    setTrades((prev) => (prev.some((p) => p.id === row.id) ? prev : [row, ...prev].slice(0, 50)));
  });

  /**
   * Loads the tape. Shared by the first load, the refresh button and the poll.
   *
   * The tape used to load once, from this platform's own capture only — empty
   * on every page load — and never again unless refresh was pressed. It now
   * reads `/live-trades` (indexer history merged with the live capture) and
   * polls while the Trades tab is open.
   */
  const loadTrades = useCallback(async () => {
    const request = ++tradesRequestRef.current;
    const sideParam = tradeFilter === 'buy' ? '&side=BUY' : tradeFilter === 'sell' ? '&side=SELL' : '';
    tradesInFlightRef.current = true;
    try {
      const res = await fetch(`/api/v1/tokens/solana/${safeMint}/live-trades?limit=50${sideParam}`);
      const body = res.ok ? await res.json() : null;
      // Stale only if fresher rows already landed.
      if (request <= tradesAppliedRef.current) return;
      const rows = body?.data?.trades;
      if (!Array.isArray(rows)) {
        setTradesState('error');
        return;
      }
      tradesAppliedRef.current = request;
      setTrades(rows.map(tapeRow));
      setTradesCoverage(body?.data?.coverage ?? null);
      setTradesState('loaded');
    } catch {
      if (request > tradesAppliedRef.current) setTradesState('error');
    } finally {
      tradesInFlightRef.current = false;
    }
  }, [safeMint, tradeFilter]);

  const loadTopTraders = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tokens/solana/${safeMint}/top-traders?limit=15`);
      const body = res.ok ? await res.json() : null;
      if (!Array.isArray(body?.data?.topTraders)) return;
      setTopTraders(body.data.topTraders);
      setTopTradersMeta(
        typeof body.data.tradesConsidered === 'number' ? { trades: body.data.tradesConsidered } : null,
      );
    } catch {
      // The table keeps its last rows; the next poll retries.
    }
  }, [safeMint]);

  // A different token starts from nothing, not from the last token's tape.
  useEffect(() => {
    setTrades([]);
    setTradesState('loading');
    setTradesCoverage(null);
    // A new token's first response must not be judged stale against the old
    // token's sequence.
    tradesAppliedRef.current = 0;
    tradesRequestRef.current = 0;
    setTopTraders([]);
    setTopTradersMeta(null);
    setDevActivities([]);
  }, [safeMint]);

  // Live while visible: the tape every 5s on the Trades tab, rankings every
  // 20s on Top Traders. A hidden tab polls nothing.
  useEffect(() => {
    if (activeTab !== 'trades' && activeTab !== 'top-traders') return;
    const run = activeTab === 'trades' ? loadTrades : loadTopTraders;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      // Never stack a second request on a feed slower than the interval.
      if (activeTab === 'trades' && tradesInFlightRef.current) return;
      void run();
    }, activeTab === 'trades' ? 5_000 : 20_000);
    return () => clearInterval(id);
  }, [activeTab, loadTrades, loadTopTraders]);

  // Dev Activity: the deployer's own trades, from the same tape. `/dev-activity`
  // returns no timeline, and its empty `events` used to be the whole table.
  useEffect(() => {
    const creator = devProfile.creatorWallet;
    if (!creator) return;
    let alive = true;
    fetch(`/api/v1/tokens/solana/${safeMint}/live-trades?wallet=${encodeURIComponent(creator)}&limit=50`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const rows = body?.data?.trades;
        if (!alive || !Array.isArray(rows)) return;
        setDevActivities(
          rows.map((t: any): DevActivityEvent => {
            const row = tapeRow(t);
            return {
              id: row.id,
              type: row.type,
              label: row.type === 'buy' ? 'Dev Buy' : 'Dev Sell',
              amountSol: row.amountSol,
              tokens: row.tokens,
              price: row.price,
              valueUsd: row.valueUsd,
              devBalanceAfter: '—',
              devSupplyPct: '—',
              time: row.time,
              txHash: row.txHash ?? '',
            };
          }),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [safeMint, devProfile.creatorWallet]);

  // ---------------------------------------------------------------------------
  // API ROUTING: Fetch Data Dynamically from API Endpoints
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    // 0. Aim the live stream at this token for as long as the page is open.
    //
    // Enrichment is budget-capped, so a market-wide sweep and a single token's
    // tape cannot both be served. Focusing trades breadth for depth on the
    // token actually being watched; the sweep resumes on unmount. Failure here
    // is non-fatal — the tape then shows whatever was already captured.
    void fetch('/api/v1/market/live/focus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mint: safeMint }),
    }).catch(() => {});

    // 1. Trade tape — see `loadTrades`.
    void loadTrades();

    // 2. Fetch Dev Activity
    fetch(`/api/v1/tokens/solana/${safeMint}/dev-activity?filter=${devFilter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // `events` is always empty here (no timeline is reconstructed); the
        // deployer's trades come from the tape instead — see the effect above.
        // `/dev-activity` returns the deployer's real identity and mint
        // history. Fields it cannot know stay null rather than being filled.
        const profile = data?.data;
        if (profile && isMounted) {
          setDevProfile({
            creatorWallet: profile.creatorAddress ?? null,
            devMints: typeof profile.devMints === 'number' ? profile.devMints : null,
            devMigrations: typeof profile.devMigrations === 'number' ? profile.devMigrations : null,
            migrationRatePct:
              typeof profile.migrationRatePct === 'number' ? profile.migrationRatePct : null,
            mintAuthorityDisabled: profile.mintAuthorityDisabled ?? null,
            freezeAuthorityDisabled: profile.freezeAuthorityDisabled ?? null,
            // Jupiter's own read of the dev wallet's balance against supply.
            currentHoldingSupplyPct:
              typeof profile.devBalancePct === 'number' ? profile.devBalancePct : null,
          });
        }
      })
      .catch(() => {});


    // 3. Fetch Bubble Map
    fetch(`/api/v1/tokens/solana/${safeMint}/bubble-map`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data?.data;
        if (!payload || !isMounted) return;
        if (payload.nodes) setMapClusterNodes(payload.nodes);
        setMapTop10ConcentrationPct(
          typeof payload.top10ConcentrationPct === 'number' ? payload.top10ConcentrationPct : null,
        );
      })
      .catch(() => {});

    // 4. Fetch Liquidity Pools
    fetch(`/api/v1/tokens/solana/${safeMint}/liquidity`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.pools && isMounted) {
          setLiquidityPools(data.data.pools);
        }
        // `/liquidity` returns no per-provider breakdown by design -- see the
        // `topLiquidityProviders` state comment -- so there is nothing to set
        // here. The table below renders its own "not available" state.
        if (data?.data?.totalLiquidityUsd && isMounted) {
          const n = Number(data.data.totalLiquidityUsd);
          setTotalLiquidityDisplay(
            Number.isFinite(n)
              ? n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
                : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
                : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
                : `$${n.toFixed(2)}`
              : null,
          );
        }
      })
      .catch(() => {});

    // 5. Fetch Holders
    // Real concentration from chain state. The endpoint returns raw numbers,
    // so formatting happens here rather than rendering 7193508364031.43106.
    fetch(`/api/v1/tokens/solana/${safeMint}/holders`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const payload = data?.data;
        if (!payload?.holders || !isMounted) return;

        const compact = (n: number) =>
          n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
          : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
          : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K`
          : n.toLocaleString(undefined, { maximumFractionDigits: 4 });

        setTopHolders(
          payload.holders.map((h: any) => ({
            rank: h.rank,
            address: `${String(h.address).slice(0, 4)}...${String(h.address).slice(-4)}`,
            fullAddress: h.address,
            // Only the chain-supported label. "Whale #1" and "Smart Money"
            // were invented; an unlabelled holder shows a dash.
            tag: h.tag ?? '—',
            balance: compact(Number(h.balance) || 0),
            percent: h.percent === null ? '—' : `${Number(h.percent).toFixed(2)}%`,
            // The endpoint has balances, not prices, so no USD value is
            // claimed rather than one being derived from a stale price.
            valueUsd: '—',
            isContract: h.isContract,
          })),
        );

        // The chain caps this view at 20 accounts, so the true holder count is
        // not observable. It was previously `holders.length * 175` — a total
        // manufactured by multiplying the row count by a constant.
        // `getTokenLargestAccounts` caps at 20 and publishes no total, so this
        // stays null and the badge simply reads "Holders".
        setHoldersTop10Pct(
          typeof payload.top10ConcentrationPct === 'number' ? payload.top10ConcentrationPct : null,
        );
        setHoldersDisplay(
          typeof payload.totalHoldersCount === 'number'
            ? payload.totalHoldersCount.toLocaleString()
            : null,
        );
      })
      .catch(() => {});

    // 6. Top Traders — see `loadTopTraders`.
    void loadTopTraders();

    return () => {
      isMounted = false;
      // Hand the budget back to the market-wide sweep.
      void fetch('/api/v1/market/live/focus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mint: null }),
      }).catch(() => {});
    };
  }, [safeMint, tradeFilter, devFilter, loadTrades, loadTopTraders]);

  // Calculate live expected output
  const solNum = parseFloat(instantSolAmount) || 0;
  /**
   * The pre-quote token estimate.
   *
   * This multiplied by a hardcoded `solUsdRate = 150.0` — the third distinct
   * SOL price in the app, alongside the status bar's $142.50 and Discover's
   * real ~$95. The estimate is now derived from the token's own price against
   * the SOL amount, and shown as `—` until a real quote returns, rather than
   * from a constant.
   */
  const estimatedTokens =
    solPriceUsd !== null && safePrice > 0
      ? ((solNum * solPriceUsd) / safePrice).toFixed(0)
      : null;

  // ---------------------------------------------------------------------------
  // API ROUTING: Execute Instant Buy via POST /api/v1/trading/instant
  // ---------------------------------------------------------------------------
  /**
   * Quotes a buy. It does not execute one.
   *
   * This previously announced "Instant Buy CONFIRMED" with a transaction hash,
   * and — worse — its catch block reported the same success when the request
   * failed outright, so a user saw "Bought ~X TOKEN" for a trade that had not
   * even been attempted. The server route was fabricating the confirmation and
   * the client was fabricating one again on failure.
   *
   * Sentinel holds no keys, so a swap can only exist once the user signs it in
   * their wallet. What can honestly be shown here is a real quote.
   */
  const handleExecuteInstantBuy = async () => {
    const solNum = parseFloat(instantSolAmount);
    if (!Number.isFinite(solNum) || solNum <= 0) return;

    setIsInstantBuying(true);
    setInstantTradeError(null);
    try {
      const res = await fetch('/api/v1/trading/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenSymbol: safeSymbol,
          tokenMint: safeMint,
          side: 'buy',
          amountSol: solNum,
          slippagePct: parseFloat(instantSlippage) || 1.0,
        }),
      });

      const json = await res.json().catch(() => null);
      const quote = json?.data ?? json;

      if (!res.ok || !quote?.outputAmount) {
        const reason = json?.error?.message || `Quote failed (${res.status})`;
        setInstantTradeError(reason);
        addExecutionLog({ text: `[QUOTE] ${safeSymbol} buy failed: ${reason}`, level: 'error' });
        return;
      }

      const received = Number(quote.outputAmount).toLocaleString(undefined, { maximumFractionDigits: 4 });
      const venue = Array.isArray(quote.route) && quote.route.length ? quote.route.join(' -> ') : 'Jupiter';
      const impact =
        quote.priceImpactPct === null || quote.priceImpactPct === undefined
          ? 'impact unknown'
          : `${Number(quote.priceImpactPct).toFixed(2)}% impact`;

      setInstantQuote({
        side: 'buy',
        summary: `${solNum} SOL -> ~${received} $${safeSymbol}`,
        minimumReceived: quote.minimumReceived,
        route: venue,
        impact,
      });

      addNotification({
        title: 'Quote ready — signature required',
        message: `${solNum} SOL buys ~${received} $${safeSymbol} via ${venue} (${impact}). Sign in your wallet to execute.`,
        type: 'execution',
      });

      addExecutionLog({
        text: `[QUOTE] ${solNum} SOL -> ~${received} $${safeSymbol} via ${venue}, min ${quote.minimumReceived}. Not yet signed.`,
        level: 'info',
      });
    } catch (err) {
      // A failed quote is a failure. It is never reported as a purchase.
      const reason = err instanceof Error ? err.message : 'Quote request failed';
      setInstantTradeError(reason);
      addExecutionLog({ text: `[QUOTE] ${safeSymbol} buy failed: ${reason}`, level: 'error' });
    } finally {
      setIsInstantBuying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // API ROUTING: Execute Instant Sell via POST /api/v1/trading/instant
  // ---------------------------------------------------------------------------
  /**
   * Quotes a sell. See handleExecuteInstantBuy — same reasoning, same refusal
   * to report an unexecuted trade as done.
   */
  const handleExecuteInstantSell = async (pct?: number) => {
    const targetPct = pct ?? 100;
    setIsInstantSelling(true);
    setInstantTradeError(null);
    try {
      const res = await fetch('/api/v1/trading/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tokenSymbol: safeSymbol,
          tokenMint: safeMint,
          side: 'sell',
          // The position size is not known here without a balance lookup, so
          // the quote is for the token amount the caller specified.
          // Percentage of the position the caller selected. Without a balance
          // lookup this component cannot know the true holding, so the quote is
          // explicitly for the amount requested rather than an assumed one.
          amountSol: Math.max(0.000001, (parseFloat(instantSolAmount) || 0.1) * (targetPct / 100)),
          slippagePct: parseFloat(instantSlippage) || 1.0,
        }),
      });

      const json = await res.json().catch(() => null);
      const quote = json?.data ?? json;

      if (!res.ok || !quote?.outputAmount) {
        const reason = json?.error?.message || `Quote failed (${res.status})`;
        setInstantTradeError(reason);
        addExecutionLog({ text: `[QUOTE] ${safeSymbol} sell failed: ${reason}`, level: 'error' });
        return;
      }

      const received = Number(quote.outputAmount).toLocaleString(undefined, { maximumFractionDigits: 6 });
      const venue = Array.isArray(quote.route) && quote.route.length ? quote.route.join(' -> ') : 'Jupiter';

      setInstantQuote({
        side: 'sell',
        summary: `${targetPct}% of $${safeSymbol} -> ~${received} SOL`,
        minimumReceived: quote.minimumReceived,
        route: venue,
        impact:
          quote.priceImpactPct === null || quote.priceImpactPct === undefined
            ? 'impact unknown'
            : `${Number(quote.priceImpactPct).toFixed(2)}% impact`,
      });

      addNotification({
        title: 'Quote ready — signature required',
        message: `Selling ${targetPct}% of $${safeSymbol} returns ~${received} SOL via ${venue}. Sign in your wallet to execute.`,
        type: 'execution',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Quote request failed';
      setInstantTradeError(reason);
      addExecutionLog({ text: `[QUOTE] ${safeSymbol} sell failed: ${reason}`, level: 'error' });
    } finally {
      setIsInstantSelling(false);
    }
  };

  /**
   * The caller's real position in this token, or null.
   *
   * This was a hardcoded object — 58,823.50 tokens at an entry of $0.0385 with
   * a safety score of 94 — rendered for every token and every visitor, badged
   * "ACTIVE POSITION" and wired to live Sell 25/50/100% controls. A user could
   * act on a holding they did not have. With `currentPrice` at 0 it also
   * printed malformed figures like "+$-2264.71" and "+-100.00% ROI", which is
   * how it became visible.
   *
   * Null means no position, and the tab says so rather than inventing one.
   */
  const [userPosition, setUserPosition] = useState<{
    token: string;
    mint: string;
    amountTokens: number;
    avgEntryPrice: number | null;
    currentValueUsd: number | null;
    unrealizedPnlUsd: number | null;
    unrealizedPnlPct: number | null;
  } | null>(null);
  const [positionState, setPositionState] = useState<'no-wallet' | 'loading' | 'loaded' | 'error'>(
    'no-wallet',
  );

  useEffect(() => {
    const wallet = connectedWallet?.address;
    if (!wallet) {
      setUserPosition(null);
      setPositionState('no-wallet');
      return;
    }

    let alive = true;
    setPositionState('loading');

    fetch(`/api/v1/portfolio/${wallet}/positions`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!alive) return;
        const rows = body?.data?.positions ?? body?.positions;
        if (!Array.isArray(rows)) {
          setPositionState('error');
          return;
        }
        const held = rows.find(
          (row: any) => row?.mint === safeMint || row?.tokenMint === safeMint,
        );
        if (!held) {
          setUserPosition(null);
          setPositionState('loaded');
          return;
        }
        const amount = Number(held.amount ?? held.quantity ?? 0);
        const entry = Number(held.avgEntryPrice ?? held.averagePrice);
        const value = Number(held.currentValueUsd ?? held.valueUsd);
        setUserPosition({
          token: `$${safeSymbol}`,
          mint: safeMint,
          amountTokens: Number.isFinite(amount) ? amount : 0,
          avgEntryPrice: Number.isFinite(entry) ? entry : null,
          currentValueUsd: Number.isFinite(value) ? value : null,
          unrealizedPnlUsd: Number.isFinite(Number(held.unrealizedPnlUsd))
            ? Number(held.unrealizedPnlUsd)
            : null,
          unrealizedPnlPct: Number.isFinite(Number(held.unrealizedPnlPct))
            ? Number(held.unrealizedPnlPct)
            : null,
        });
        setPositionState('loaded');
      })
      .catch(() => {
        if (alive) setPositionState('error');
      });

    return () => {
      alive = false;
    };
  }, [connectedWallet?.address, safeMint, safeSymbol]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    void loadTrades().finally(() => setTimeout(() => setIsRefreshing(false), 400));
  };

  // Filtered trades
  const filteredTrades = trades.filter((tr) => {
    if (tradeFilter === 'buy' && tr.type !== 'buy') return false;
    if (tradeFilter === 'sell' && tr.type !== 'sell') return false;
    if (tradeFilter === 'whale' && !tr.isWhale) return false;
    if (tradeSearch && !tr.wallet.toLowerCase().includes(tradeSearch.toLowerCase()) && !(tr.txHash ?? '').toLowerCase().includes(tradeSearch.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className={`rounded-xl border border-sentinel-750 bg-sentinel-900 shadow-card overflow-hidden transition-all duration-200 ${isExpanded ? 'ring-1 ring-sky-500/40' : ''}`}>
      
      {/* ========================================================================= */}
      {/* 1. Axiom-Style Sleek Navigation Header Bar                                */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between border-b border-sentinel-800 bg-sentinel-950/90 px-3 py-1.5 gap-2 select-none">
        
        {/* Left Side: Horizontal Tab List with indicators */}
        <div className="terminal-detail-tabs flex min-w-0 max-w-full items-center gap-1 overflow-x-auto py-1" aria-label="Token details">
          {/* Trades Tab */}
          <button
            onClick={() => setActiveTab('trades')}
            aria-pressed={activeTab === 'trades'}
            className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'trades'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Trades</span>
          </button>

          {/* Positions Tab */}
          <button
            onClick={() => setActiveTab('positions')}
            aria-pressed={activeTab === 'positions'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'positions'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <span>Positions</span>
            {/* Was a hardcoded 1 — the tab claimed a position for every visitor,
                matching the fabricated one it opened onto. */}
            {userPosition && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-2xs font-mono text-emerald-400 font-bold">
                1
              </span>
            )}
          </button>

          {/* Orders Tab */}
          <button
            onClick={() => setActiveTab('orders')}
            aria-pressed={activeTab === 'orders'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Target className="h-3.5 w-3.5 text-sky-400" />
            <span>Orders</span>
          </button>

          {/* Dev Activity Tab */}
          <button
            onClick={() => setActiveTab('dev-activity')}
            aria-pressed={activeTab === 'dev-activity'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dev-activity'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-rose-400" />
            <span>Dev Activity</span>
            {devProfile.currentHoldingSupplyPct !== null && (
              <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 text-2xs font-mono text-rose-300 font-bold">
                {devProfile.currentHoldingSupplyPct.toFixed(2)}% Dev
              </span>
            )}
          </button>

          {/* Maps Tab (Bubble Maps / Cluster Graphs) */}
          <button
            onClick={() => setActiveTab('maps')}
            aria-pressed={activeTab === 'maps'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'maps'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Network className="h-3.5 w-3.5 text-cyan-400" />
            <span>Maps</span>
          </button>

          {/* Liquidity Providers & DEX Pools Tab */}
          <button
            onClick={() => setActiveTab('liquidity')}
            aria-pressed={activeTab === 'liquidity'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'liquidity'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            <span>Liquidity{totalLiquidityDisplay ? ` (${totalLiquidityDisplay})` : ''}</span>
          </button>

          {/* Token Audit Tab */}
          <button
            onClick={() => setActiveTab('audit')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
            <span>Token Audit</span>
          </button>

          {/* Holders Tab */}
          <button
            onClick={() => setActiveTab('holders')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'holders'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>Holders{holdersDisplay ? ` (${holdersDisplay})` : ''}</span>
          </button>

          {/* Top Traders Tab */}
          <button
            onClick={() => setActiveTab('top-traders')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'top-traders'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Award className="h-3.5 w-3.5 text-amber-400" />
            <span>Top Traders</span>
          </button>

          {/* Dev Tokens Tab */}
          <button
            onClick={() => setActiveTab('dev-tokens')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dev-tokens'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-indigo-400" />
            {/* Was "(100)" regardless of deployer. */}
            <span>
              Dev History
              {devProfile.devMints === null ? '' : ` (${devProfile.devMints.toLocaleString()})`}
            </span>
          </button>
        </div>

        {/* Right Side: Quick Instant Trade & Terminal Controls (matching Axiom bottom bar) */}
        <div className="flex items-center gap-2">
          
          {/* Instant Trade Toggle Button */}
          <button
            onClick={() => setShowInstantTrade(!showInstantTrade)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-sm ${
              showInstantTrade
                ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-glow-buy'
                : 'border border-sentinel-700 bg-sentinel-800 text-slate-300 hover:text-white'
            }`}
            title="Toggle Instant Trade Bar"
          >
            <Zap className={`h-3.5 w-3.5 fill-current ${showInstantTrade ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>Instant Trade</span>
            <span className={`h-1.5 w-1.5 rounded-full ${showInstantTrade ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          </button>

          {/* Currency Format Toggle (USD / SOL) */}
          <button
            onClick={() => setCurrencyMode(currencyMode === 'USD' ? 'SOL' : 'USD')}
            className="inline-flex items-center gap-1 rounded-md border border-sentinel-800 bg-sentinel-900 px-2 py-1 text-2xs font-mono text-slate-300 hover:bg-sentinel-800 transition"
            title="Toggle USD / SOL Denomination"
          >
            <span className="text-slate-500">⇅</span>
            <span>{currencyMode}</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={handleManualRefresh}
            className="p-1 rounded-md border border-sentinel-800 bg-sentinel-900 text-slate-400 hover:text-slate-200 hover:bg-sentinel-800 transition"
            title="Refresh Table Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Expand / Collapse Height */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md border border-sentinel-800 bg-sentinel-900 text-slate-400 hover:text-slate-200 hover:bg-sentinel-800 transition hidden sm:inline-flex"
            title={isExpanded ? 'Collapse View' : 'Expand View'}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DEDICATED INSTANT TRADE BAR (Axiom Fast Scalp / Buy Widget)             */}
      {/* ========================================================================= */}
      {showInstantTrade && (
        <>
          {/* Click-catcher. Transparent rather than dimmed */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowInstantTrade(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Instant trade"
            className="fixed bottom-16 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-sentinel-700 bg-sentinel-900/95 backdrop-blur-xl p-4 shadow-2xl space-y-3.5 transition-all animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header: Title, Token Info & Action Controls */}
            <div className="flex items-center justify-between pb-2 border-b border-sentinel-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sentinel-800/80 border border-sentinel-700 font-mono text-xs shadow-inner">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">${safeSymbol}</span>
                  <span className="text-slate-400 font-numeric">@ {safePriceFormatted}</span>
                </div>
                <div className="flex items-center gap-1 text-2xs font-mono text-slate-400">
                  <Wallet className="h-3 w-3 text-slate-500" />
                  <span>Bal:</span>
                  {activeWallet ? (
                    <span className="text-slate-200 font-bold">{activeWallet.balanceSol.toFixed(2)} SOL</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWalletModalOpen(true)}
                      className="text-sky-400 font-bold hover:underline"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Full Drawer CTA */}
                <button
                  onClick={() =>
                    setQuickBuyOpen(true, {
                      name: `${safeSymbol} Token`,
                      symbol: `$${safeSymbol}`,
                      mint: tokenMint,
                      price: safePriceFormatted,
                      mcap: '$42.5M',
                    })
                  }
                  className="p-1.5 rounded-lg bg-sentinel-800 hover:bg-sentinel-750 border border-sentinel-700 text-slate-400 hover:text-white transition"
                  title="Open Full Execution Terminal Drawer"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setShowInstantTrade(false)}
                  aria-label="Close instant trade"
                  className="p-1.5 rounded-lg bg-sentinel-800 hover:bg-sentinel-750 border border-sentinel-700 text-slate-400 hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Mode Switcher: BUY vs SELL */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-sentinel-950 border border-sentinel-800">
              <button
                type="button"
                onClick={() => setInstantTradeSide('buy')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  instantTradeSide === 'buy'
                    ? 'bg-emerald-500 text-slate-950 shadow-glow-buy'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
                }`}
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>BUY SOL</span>
              </button>
              <button
                type="button"
                onClick={() => setInstantTradeSide('sell')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                  instantTradeSide === 'sell'
                    ? 'bg-rose-500 text-white shadow-glow-sell'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
                }`}
              >
                <Percent className="h-3.5 w-3.5" />
                <span>SELL %</span>
              </button>
            </div>

            {/* ---------------- BUY PANEL ---------------- */}
            {instantTradeSide === 'buy' && (
              <div className="space-y-3 animate-in fade-in duration-100">
                {/* Buy Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-2xs font-mono">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider">Buy Amount</span>
                    <span className="text-emerald-400 font-bold font-numeric">
                      ≈ {estimatedTokens === null ? '—' : Number(estimatedTokens).toLocaleString()} ${safeSymbol}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 font-numeric">
                    {['0.1', '0.5', '1.0', '2.5', '5.0'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setInstantSolAmount(preset)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                          instantSolAmount === preset
                            ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-glow-buy'
                            : 'bg-sentinel-800/80 text-slate-300 hover:text-white hover:bg-sentinel-750 border border-sentinel-700'
                        }`}
                      >
                        {preset} SOL
                      </button>
                    ))}
                  </div>
                </div>

                {/* Amount Input & Slippage Row */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7 relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.01"
                      value={instantSolAmount}
                      onChange={(e) => setInstantSolAmount(e.target.value)}
                      className="w-full rounded-lg border border-sentinel-700 bg-sentinel-950 px-2.5 py-1.5 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      placeholder="SOL amt"
                    />
                    <span className="absolute right-2.5 top-2 text-2xs font-mono font-bold text-slate-500 pointer-events-none">
                      SOL
                    </span>
                  </div>

                  {/* Slippage & MEV Chip */}
                  <div className="col-span-5 flex items-center justify-between gap-1 text-2xs font-mono text-slate-300 bg-sentinel-950 px-2 py-1.5 rounded-lg border border-sentinel-700">
                    <span className="text-slate-500">Slip:</span>
                    <select
                      value={instantSlippage}
                      onChange={(e) => setInstantSlippage(e.target.value)}
                      className="bg-transparent text-sky-400 font-bold focus:outline-none cursor-pointer text-2xs"
                    >
                      <option value="0.5" className="bg-sentinel-900">0.5%</option>
                      <option value="1.0" className="bg-sentinel-900">1.0%</option>
                      <option value="2.0" className="bg-sentinel-900">2.0%</option>
                      <option value="3.0" className="bg-sentinel-900">3.0%</option>
                    </select>
                    <span className="text-emerald-400 font-bold text-2xs" title="Anti-MEV Turbo Enabled">⚡ MEV</span>
                  </div>
                </div>

                {/* Big Instant Buy Trigger */}
                {!activeWallet ? (
                  <Button
                    onClick={() => setWalletModalOpen(true)}
                    variant="buy"
                    size="md"
                    className="w-full font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-950/40"
                    leftIcon={<Wallet className="h-4 w-4 text-slate-950" />}
                  >
                    Connect Wallet to Buy
                  </Button>
                ) : (
                  <Button
                    onClick={handleExecuteInstantBuy}
                    variant="buy"
                    size="md"
                    isLoading={isInstantBuying}
                    className="w-full font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-950/40"
                    leftIcon={<Zap className="h-4 w-4 fill-current text-slate-950" />}
                  >
                    BUY {instantSolAmount} SOL
                  </Button>
                )}
              </div>
            )}

            {/* ---------------- SELL PANEL ---------------- */}
            {instantTradeSide === 'sell' && (
              <div className="space-y-3 animate-in fade-in duration-100">
                {/* Sell Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-2xs font-mono">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider">Sell Portion</span>
                    {/* Was a hardcoded 58,823.50 shown above the sell presets
                        for every token and every visitor — the same figure the
                        fabricated Positions tab reported. */}
                    <span className="text-rose-400 font-bold font-numeric">
                      Holding:{' '}
                      {userPosition
                        ? `${userPosition.amountTokens.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })} $${safeSymbol}`
                        : positionState === 'no-wallet'
                          ? 'connect a wallet'
                          : 'n/a'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 font-numeric">
                    {SELL_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setSellPercent(pct);
                          setCustomSellPercent('');
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-bold font-numeric transition ${
                          sellPercent === pct && !customSellPercent
                            ? 'bg-rose-500/25 border-rose-500/60 text-rose-200 shadow-glow-sell'
                            : 'bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}

                    {/* Custom fraction */}
                    <div className="flex items-center rounded-lg border border-rose-500/30 bg-rose-500/5 px-1.5">
                      <input
                        value={customSellPercent}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          setCustomSellPercent(raw);
                          const n = Number(raw);
                          if (Number.isFinite(n) && n > 0) setSellPercent(Math.min(100, n));
                        }}
                        placeholder="Custom"
                        className="w-full bg-transparent text-xs font-mono font-bold text-rose-200 placeholder-rose-500/60 focus:outline-none"
                      />
                      <span className="text-2xs font-mono font-bold text-rose-400 pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                {/* Amount Input & Slippage Row */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-7 relative">
                    <input
                      type="number"
                      step="5"
                      min="1"
                      max="100"
                      value={effectiveSellPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSellPercent(Math.min(100, Math.max(0, val)));
                        setCustomSellPercent(e.target.value);
                      }}
                      className="w-full rounded-lg border border-sentinel-700 bg-sentinel-950 px-2.5 py-1.5 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      placeholder="Sell %"
                    />
                    <span className="absolute right-2.5 top-2 text-2xs font-mono font-bold text-slate-500 pointer-events-none">
                      %
                    </span>
                  </div>

                  {/* Slippage & MEV Chip */}
                  <div className="col-span-5 flex items-center justify-between gap-1 text-2xs font-mono text-slate-300 bg-sentinel-950 px-2 py-1.5 rounded-lg border border-sentinel-700">
                    <span className="text-slate-500">Slip:</span>
                    <select
                      value={instantSlippage}
                      onChange={(e) => setInstantSlippage(e.target.value)}
                      className="bg-transparent text-sky-400 font-bold focus:outline-none cursor-pointer text-2xs"
                    >
                      <option value="0.5" className="bg-sentinel-900">0.5%</option>
                      <option value="1.0" className="bg-sentinel-900">1.0%</option>
                      <option value="2.0" className="bg-sentinel-900">2.0%</option>
                      <option value="3.0" className="bg-sentinel-900">3.0%</option>
                    </select>
                    <span className="text-emerald-400 font-bold text-2xs">⚡ MEV</span>
                  </div>
                </div>

                {/* Big Instant Sell Trigger */}
                {!activeWallet ? (
                  <button
                    type="button"
                    onClick={() => setWalletModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold font-mono text-xs text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 border border-rose-500/50 shadow-lg shadow-rose-950/40 transition-all"
                  >
                    <Wallet className="h-4 w-4" />
                    <span>CONNECT WALLET TO SELL</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleExecuteInstantSell()}
                    disabled={isInstantSelling}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold font-mono text-xs text-white bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 border border-rose-500/50 shadow-lg shadow-rose-950/40 transition-all disabled:opacity-50"
                  >
                    {isInstantSelling ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Percent className="h-4 w-4" />
                    )}
                    <span>SELL {effectiveSellPercent}% POSITION</span>
                  </button>
                )}
              </div>
            )}

            {/* Quote result.
                This banner used to read "Settled" with a green tick for a
                trade that had never been submitted — and it appeared even when
                the request failed. It now states exactly what exists: a price,
                and the fact that nothing is on-chain until the wallet signs. */}
            {instantQuote && (
              <div className="mt-2 rounded-xl border border-sky-500/40 bg-sky-950/70 px-3 py-2 text-xs text-sky-200 font-mono animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{instantQuote.summary}</span>
                  <span className="text-2xs text-amber-300/90 font-numeric shrink-0">
                    Signature required
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-sky-300/80">
                  <span>min {instantQuote.minimumReceived}</span>
                  <span>{instantQuote.impact}</span>
                  <span className="truncate">via {instantQuote.route}</span>
                </div>
              </div>
            )}

            {instantTradeError && (
              <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/70 px-3 py-2 text-xs text-rose-300 font-mono animate-in fade-in slide-in-from-top-1">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{instantTradeError}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. Tab Content Container                                                 */}
      {/* ========================================================================= */}
      <div className={`p-3 overflow-y-auto transition-all ${isExpanded ? 'min-h-[460px] max-h-[640px]' : 'min-h-[280px] max-h-[380px]'}`}>
        
        {/* ========================================================================= */}
        {/* TAB 1: TRADES (Recent Market Transactions from /api/v1/tokens/.../trades) */}
        {/* ========================================================================= */}
        {activeTab === 'trades' && (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-sentinel-800/80">
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {(['all', 'buy', 'sell', 'whale'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setTradeFilter(filterKey)}
                    className={`px-2.5 py-0.8 rounded-md text-2xs font-bold uppercase transition ${
                      tradeFilter === filterKey
                        ? filterKey === 'buy'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : filterKey === 'sell'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : filterKey === 'whale'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200 bg-sentinel-850'
                    }`}
                  >
                    {filterKey === 'whale' ? '🐋 Whales (>5 SOL)' : filterKey}
                  </button>
                ))}
              </div>

              <div className="relative w-48">
                <input
                  type="text"
                  placeholder="Filter wallet / tx..."
                  value={tradeSearch}
                  onChange={(e) => setTradeSearch(e.target.value)}
                  className="w-full rounded-md border border-sentinel-800 bg-sentinel-950 px-2.5 py-0.8 text-2xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* High Density Trades Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase tracking-wider">
                    <th className="py-1.5 px-2">Type</th>
                    <th className="py-1.5 px-2">Price</th>
                    <th className="py-1.5 px-2">Amount SOL</th>
                    <th className="py-1.5 px-2">Amount ${safeSymbol}</th>
                    <th className="py-1.5 px-2">Total Value</th>
                    <th className="py-1.5 px-2">Maker</th>
                    <th className="py-1.5 px-2 text-right">Age</th>
                    <th className="py-1.5 px-2 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs font-mono text-slate-500">
                        {tradesState === 'loading'
                          ? 'Loading trades…'
                          : tradesState === 'error'
                            ? 'Trades could not be loaded — retrying.'
                            : trades.length > 0
                              ? 'No trades match this filter.'
                              : (tradesCoverage ?? 'No trades found for this token yet.')}
                      </td>
                    </tr>
                  )}
                  {filteredTrades.map((tr) => (
                    <tr key={tr.id} className="hover:bg-sentinel-800/50 transition-colors group">
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded text-2xs uppercase ${
                            tr.type === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {tr.type === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {tr.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-slate-200">{tr.price}</td>
                      <td className="py-2 px-2 font-bold text-white flex items-center gap-1">
                        {tr.amountSol}
                        {tr.isWhale && <span className="text-2xs" title="Whale Order">🐋</span>}
                      </td>
                      <td className="py-2 px-2 text-slate-300 font-mono text-2xs">{tr.tokens}</td>
                      <td className="py-2 px-2 font-bold text-slate-100">{currencyMode === 'USD' ? tr.valueUsd : tr.amountSol}</td>
                      <td className="py-2 px-2 font-mono text-slate-400">
                        <button
                          onClick={() => handleCopy(tr.fullWallet ?? tr.wallet)}
                          className="inline-flex items-center gap-1 hover:text-sky-300 transition"
                        >
                          <span>{tr.wallet}</span>
                          {copiedAddress === (tr.fullWallet ?? tr.wallet) ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-2xs text-slate-400">{tr.timestamp ? tapeAge(tr.timestamp) : tr.time}</td>
                      <td className="py-2 px-2 text-right font-mono text-2xs">
                        {/* A trade still confirming has no signature yet, and
                            an explorer link built from a fabricated one leads
                            nowhere. Say pending instead. */}
                        {tr.txHash ? (
                          <a
                            href={`https://solscan.io/tx/${tr.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-sky-400 inline-flex items-center gap-0.5"
                          >
                            <span>{tr.txHash.slice(0, 4)}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-600" title="Awaiting on-chain confirmation">pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: POSITIONS (User Holdings & Active Trades)                         */}
        {/* ========================================================================= */}
        {activeTab === 'positions' && (
          <div className="space-y-4">
            {/* Three honest states. The tab previously rendered a fabricated
                position for every visitor, badged ACTIVE and wired to live
                Sell controls. */}
            {positionState === 'no-wallet' && (
              <div className="p-6 text-center border border-dashed border-sentinel-800 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-slate-300">No wallet connected</p>
                <p className="text-2xs text-slate-500">
                  Connect a wallet to see your position in ${safeSymbol}.
                </p>
              </div>
            )}

            {positionState === 'loading' && (
              <div className="p-6 text-center border border-dashed border-sentinel-800 rounded-xl">
                <p className="text-2xs text-slate-500 font-mono">Loading your position…</p>
              </div>
            )}

            {positionState === 'error' && (
              <div className="p-6 text-center border border-dashed border-rose-900/50 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-rose-300">Could not load your position</p>
                <p className="text-2xs text-slate-500">
                  The portfolio service did not respond. Nothing is shown rather than an estimate.
                </p>
              </div>
            )}

            {positionState === 'loaded' && !userPosition && (
              <div className="p-6 text-center border border-dashed border-sentinel-800 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-slate-300">You hold no ${safeSymbol}</p>
                <p className="text-2xs text-slate-500">
                  A position appears here once you buy.
                </p>
              </div>
            )}

            {positionState === 'loaded' && userPosition && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-numeric text-xs">
                  <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                    <span className="text-slate-400 text-2xs font-mono uppercase block">Position Size</span>
                    <span className="text-base font-bold text-white">
                      {userPosition.amountTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                      {userPosition.token}
                    </span>
                    <span className="text-2xs text-slate-400 block font-mono">
                      {userPosition.currentValueUsd === null
                        ? '—'
                        : `~$${userPosition.currentValueUsd.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                    <span className="text-slate-400 text-2xs font-mono uppercase block">Average Entry</span>
                    <span className="text-base font-bold text-slate-200">
                      {userPosition.avgEntryPrice === null
                        ? '—'
                        : `$${userPosition.avgEntryPrice.toFixed(6)}`}
                    </span>
                    <span className="text-2xs text-slate-500 block font-mono">
                      Mark: {currentPrice > 0 ? `$${currentPrice.toFixed(6)}` : '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                    <span className="text-slate-400 text-2xs font-mono uppercase block">Unrealized PnL</span>
                    {/* Sign comes from the number, not a hardcoded '+'. The old
                        markup produced "+$-2264.71" and "+-100.00% ROI". */}
                    <span
                      className={`text-base font-bold ${
                        (userPosition.unrealizedPnlUsd ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {userPosition.unrealizedPnlUsd === null
                        ? '—'
                        : `${userPosition.unrealizedPnlUsd >= 0 ? '+' : '-'}$${Math.abs(
                            userPosition.unrealizedPnlUsd,
                          ).toFixed(2)}`}
                    </span>
                    <span className="text-2xs font-bold block font-mono text-slate-400">
                      {userPosition.unrealizedPnlPct === null
                        ? '—'
                        : `${userPosition.unrealizedPnlPct >= 0 ? '+' : ''}${userPosition.unrealizedPnlPct.toFixed(2)}% ROI`}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                    <span className="text-slate-400 text-2xs font-mono uppercase block">Risk / Exit</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        onClick={onOpenLimitBuilder}
                        className="px-2 py-1 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-2xs font-bold"
                      >
                        + Add TP / SL
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sell controls exist only when there is something to sell. */}
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="risk-low" size="sm">Active Position</Badge>
                    <span className="text-slate-400 font-mono text-2xs">
                      Mint: {safeMint.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-2xs">Quick Sell:</span>
                    {[25, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => void handleExecuteInstantSell(pct)}
                        className="px-2 py-0.5 rounded bg-sentinel-900 border border-sentinel-750 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-2xs font-bold transition"
                      >
                        Sell {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ORDERS (Active Persistent Limit Orders)                           */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-bold text-white">Active Limit & Conditional Orders</span>
              </div>
              <Button
                onClick={onOpenLimitBuilder}
                variant="primary"
                size="xs"
                className="font-bold text-xs"
              >
                + New Limit Order
              </Button>
            </div>
            {/* Embedded Live OpenOrdersDashboard */}
            <OpenOrdersDashboard
              currentPrice={currentPrice}
              mint={safeMint}
              walletAddress={activeWallet?.address ?? null}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DEV ACTIVITY (Routed to /api/v1/tokens/.../dev-activity)            */}
        {/* ========================================================================= */}
        {activeTab === 'dev-activity' && (
          <div className="space-y-3">
            {/* Deployer summary.
                Four cards previously asserted a complete profile for every
                token: a named creator, 0.85% of supply held, +$48,250 realised
                profit, and a "LOW DUMP RISK" badge. Only the first is knowable
                from the data available, so the others report what they are. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-numeric">
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Developer Wallet</span>
                {devProfile.creatorWallet ? (
                  <button
                    onClick={() => handleCopy(devProfile.creatorWallet as string)}
                    className="font-bold text-sky-300 font-mono text-2xs hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>
                      {devProfile.creatorWallet.slice(0, 4)}…{devProfile.creatorWallet.slice(-4)}
                    </span>
                    <Copy className="h-3 w-3 text-slate-500" />
                  </button>
                ) : (
                  <span className="text-slate-600 font-mono text-2xs block mt-0.5">n/a</span>
                )}
              </div>

              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Tokens Minted By Dev</span>
                <span className="text-sm font-bold text-white font-mono block">
                  {devProfile.devMints === null ? 'n/a' : devProfile.devMints.toLocaleString()}
                </span>
                <span className="text-2xs text-slate-400 block font-mono">
                  {devProfile.devMigrations === null
                    ? 'migrations unknown'
                    : `${devProfile.devMigrations.toLocaleString()} reached a pool`}
                </span>
              </div>

              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Migration Rate</span>
                {/* A deployer with thousands of mints and a handful of
                    migrations is the signal here — a computed ratio, not a
                    rating. */}
                <span className="text-sm font-bold text-white font-mono block">
                  {devProfile.migrationRatePct === null
                    ? 'n/a'
                    : `${devProfile.migrationRatePct.toFixed(2)}%`}
                </span>
                <span className="text-2xs text-slate-500 block font-mono">of this dev&apos;s mints</span>
              </div>

              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Authorities</span>
                <span className="text-2xs font-mono block mt-0.5 text-slate-300">
                  Mint:{' '}
                  {devProfile.mintAuthorityDisabled === null
                    ? 'n/a'
                    : devProfile.mintAuthorityDisabled
                      ? 'renounced'
                      : 'ACTIVE'}
                </span>
                <span className="text-2xs font-mono block text-slate-300">
                  Freeze:{' '}
                  {devProfile.freezeAuthorityDisabled === null
                    ? 'n/a'
                    : devProfile.freezeAuthorityDisabled
                      ? 'disabled'
                      : 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-sentinel-800">
              <div className="flex items-center gap-1.5 font-mono text-xs">
                {(['all', 'buy', 'sell', 'lp'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setDevFilter(filterKey)}
                    className={`px-2.5 py-0.8 rounded-md text-2xs font-bold uppercase transition ${
                      devFilter === filterKey
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200 bg-sentinel-850'
                    }`}
                  >
                    {filterKey === 'lp' ? 'LP & Burn' : filterKey}
                  </button>
                ))}
              </div>
              <span className="text-2xs font-mono text-slate-400">
                Live endpoint: <code className="text-sky-400">/api/v1/tokens/solana/.../dev-activity</code>
              </span>
            </div>

            {/* Dev Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                    <th className="py-1.5 px-2">Action</th>
                    <th className="py-1.5 px-2">Amount SOL</th>
                    <th className="py-1.5 px-2">Tokens</th>
                    <th className="py-1.5 px-2">Price</th>
                    <th className="py-1.5 px-2">Impact</th>
                    <th className="py-1.5 px-2">Dev Supply After</th>
                    <th className="py-1.5 px-2 text-right">Age</th>
                    <th className="py-1.5 px-2 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {devActivities.filter((a) => devFilter === 'all' || a.type === devFilter).length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs font-mono text-slate-500">
                        {devProfile.creatorWallet
                          ? 'No trades by the deployer in the recent tape.'
                          : 'Deployer not identified for this token.'}
                      </td>
                    </tr>
                  )}
                  {devActivities.filter((a) => devFilter === 'all' || a.type === devFilter).map((act) => (
                    <tr key={act.id} className="hover:bg-sentinel-800/40 transition">
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono px-2 py-0.5 rounded text-2xs uppercase ${
                            act.type === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : act.type === 'sell'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : act.type === 'burn'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {act.label}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-white font-mono">{act.amountSol || '—'}</td>
                      <td className="py-2 px-2 text-slate-300 font-mono text-2xs">{act.tokens}</td>
                      <td className="py-2 px-2 font-bold text-slate-200">{act.price || '—'}</td>
                      <td className="py-2 px-2 font-mono text-2xs text-slate-300">{act.impact || '—'}</td>
                      <td className="py-2 px-2 font-mono font-bold text-sky-300">{act.devSupplyPct}</td>
                      <td className="py-2 px-2 text-right font-mono text-2xs text-slate-400">{act.time}</td>
                      <td className="py-2 px-2 text-right font-mono text-2xs">
                        <a
                          href={`https://solscan.io/tx/${act.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-sky-400 inline-flex items-center gap-0.5"
                        >
                          <span>{act.txHash.slice(0, 4)}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MAPS (Routed to /api/v1/tokens/.../bubble-map)                      */}
        {/* ========================================================================= */}
        {activeTab === 'maps' && (
          <div className="space-y-3">
            {/* Cluster Stats Bar -- was four fixed numbers ("89/100 Safe",
                "2 Wallets (0.85%)", "2.94% (4 Wallets)") for every token,
                none of them computed. Only top-10 concentration and holder
                count are actually measured; the rest say so plainly. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-numeric">
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Top 10 Concentration</span>
                <span className="text-sm font-bold text-white block font-mono">
                  {mapTop10ConcentrationPct === null ? 'Not available' : `${mapTop10ConcentrationPct.toFixed(2)}% Supply`}
                </span>
                <span className="text-2xs text-slate-500 block">Of the top 20 token accounts.</span>
              </div>
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Total Holders</span>
                <span className="text-sm font-bold text-sky-300 block font-mono">{holdersDisplay ?? 'Not available'}</span>
                <span className="text-2xs text-slate-500 block">From on-chain token accounts.</span>
              </div>
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Suspicious Clusters</span>
                <span className="text-sm font-bold text-slate-500 block font-mono">Not determined</span>
                <span className="text-2xs text-slate-500 block">Wallet-funding links are not mapped.</span>
              </div>
            </div>

            {/* Bubble Maps Visual Canvas & Inspector Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              
              {/* Left 2 Cols: Interactive SVG Bubble Canvas */}
              <div className="lg:col-span-2 rounded-xl border border-sentinel-800 bg-sentinel-950/90 p-3 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">🗺️ Interactive Bubble Map</span>
                    <span className="text-2xs font-mono text-slate-500">(Live /api/v1/tokens/.../bubble-map)</span>
                  </div>
                  {/* Only two categories are actually distinguishable on-chain
                      here -- a pool account versus any other holder. "Dev",
                      "Whales" and "Snipers" swatches used to sit alongside
                      these with no wallet ever classified into them. */}
                  <div className="flex items-center gap-2 text-2xs font-mono text-slate-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" /> DEX Pool</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> Holder</span>
                  </div>
                </div>

                {/* SVG Visual Clusters */}
                <div className="w-full flex items-center justify-center py-2">
                  <svg viewBox="0 0 580 260" className="w-full h-auto max-h-[220px] select-none">
                    <defs>
                      <pattern id="grid_tabs" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid_tabs)" />

                    {/* No connection lines: drawing one between two wallets
                        asserts a funding relationship between them, and
                        `/bubble-map` explicitly does not determine that --
                        see its `fundingSource: null`. These three used to be
                        fixed coordinates drawn for every token regardless of
                        which wallets, if any, were actually related. */}

                    {/* Render Cluster Bubbles */}
                    {mapClusterNodes.map((node) => {
                      const isSelected = selectedMapNode?.id === node.id;
                      return (
                        <g
                          key={node.id}
                          onClick={() => setSelectedMapNode(node)}
                          className="cursor-pointer transition-transform hover:scale-105"
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r}
                            fill={node.color}
                            stroke={node.borderColor}
                            strokeWidth={isSelected ? 3 : 1.5}
                            className={`transition-all duration-200 ${isSelected ? 'filter drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]' : ''}`}
                          />
                          <text
                            x={node.x}
                            y={node.y - 4}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {node.supplyPct === null || node.supplyPct === undefined
                              ? '—'
                              : `${node.supplyPct}%`}
                          </text>
                          <text
                            x={node.x}
                            y={node.y + 7}
                            textAnchor="middle"
                            fill="#98A3B3"
                            fontSize="7.5"
                            fontFamily="sans-serif"
                          >
                            {node.tag.toUpperCase()}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Right Col: Node Inspector Panel */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3 flex flex-col justify-between text-xs">
                <div>
                  <span className="text-2xs font-mono text-slate-400 uppercase tracking-wider block border-b border-sentinel-750 pb-1 mb-2">
                    Cluster Node Inspector
                  </span>

                  {selectedMapNode ? (
                    <div className="space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{selectedMapNode.label}</span>
                        <Badge variant="mono" size="sm">{selectedMapNode.tag.toUpperCase()}</Badge>
                      </div>

                      <div className="space-y-1 text-2xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Address:</span>
                          <span className="text-sky-300 font-bold">{selectedMapNode.address.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Supply Share:</span>
                          <span className="text-emerald-400 font-bold">
                            {selectedMapNode.supplyPct === null ? '—' : `${selectedMapNode.supplyPct}%`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Token Balance:</span>
                          <span className="text-white font-bold">{selectedMapNode.balanceTokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Value (USD):</span>
                          <span className="text-slate-500 font-bold">{selectedMapNode.valueUsd ?? 'Not available'}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-sentinel-800">
                          <span className="text-slate-400">Inflow Route:</span>
                          <span className="text-slate-500 text-2xs">
                            {selectedMapNode.fundingSource ?? 'Not mapped'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      <Network className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-mono">Select any bubble to inspect wallet holdings, funding source, and insider ties.</p>
                    </div>
                  )}
                </div>

                {selectedMapNode && (
                  <div className="pt-2 border-t border-sentinel-750 flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(selectedMapNode.address)}
                      className="flex-1 py-1 px-2 rounded-lg bg-sentinel-900 hover:bg-sentinel-800 text-sky-300 font-mono text-2xs border border-sentinel-750 transition text-center"
                    >
                      Copy Address
                    </button>
                    <a
                      href={`https://solscan.io/account/${selectedMapNode.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1 px-2 rounded-lg bg-sentinel-900 hover:bg-sentinel-800 text-slate-300 hover:text-white font-mono text-2xs border border-sentinel-750 transition text-center flex items-center justify-center gap-1"
                    >
                      Solscan <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: LIQUIDITY (Routed to /api/v1/tokens/.../liquidity)                   */}
        {/* ========================================================================= */}
        {activeTab === 'liquidity' && (
          <div className="space-y-4">
            {/* Aggregate liquidity -- real, from Jupiter. Shown up front
                because the per-pool cards below are empty by design: see the
                `liquidityPools` state comment. */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-2xs text-slate-400 font-mono uppercase block">Total Liquidity</span>
                <span className="text-lg font-bold font-numeric text-white">
                  {totalLiquidityDisplay ?? 'Not available'}
                </span>
              </div>
              <span className="text-2xs text-slate-500 font-mono max-w-[220px] text-right">
                Aggregate across all pools. Per-pool reserves need a DEX-by-DEX
                query this platform does not perform.
              </span>
            </div>

            {/* Pools Summary Cards */}
            {liquidityPools.length === 0 ? (
              <div className="p-5 text-center border border-dashed border-sentinel-800 rounded-xl space-y-1">
                <p className="text-xs font-bold text-slate-300">Per-pool breakdown not available</p>
                <p className="text-2xs text-slate-500">
                  Individual pool reserves, APY and lock status need a
                  DEX-by-DEX query this endpoint does not perform. The total
                  liquidity above is real.
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {liquidityPools.map((pool) => (
                <div key={pool.id} className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3 space-y-2 font-numeric">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm block">{pool.dex}</span>
                      <span className="text-2xs text-slate-400 font-mono">{pool.pair}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {pool.lockDetails.includes('Burned') ? '🔥 100% BURNED' : '🔒 LOCKED'}
                    </span>
                  </div>

                  <div className="space-y-1 text-2xs pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Liquidity:</span>
                      <span className="font-bold text-white font-mono">{pool.liquidityUsd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">24h Vol / Fees:</span>
                      <span className="text-slate-200 font-mono">{pool.volume24h} / <span className="text-emerald-400 font-bold">{pool.fees24h}</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. 24h APY:</span>
                      <span className="font-bold text-emerald-400 font-mono">{pool.apy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fee Tier:</span>
                      <span className="text-sky-300 font-mono">{pool.feeTier}</span>
                    </div>
                  </div>

                  {/* Reserves Split */}
                  <div className="pt-2 border-t border-sentinel-800/80 text-2xs font-mono text-slate-400 flex items-center justify-between">
                    <span>Pool: {pool.poolAddress.slice(0, 6)}...</span>
                    <a
                      href={`https://solscan.io/account/${pool.poolAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      View Pool <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Top Liquidity Providers Table -- always empty; see
                `topLiquidityProviders`'s declaration for why. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-sentinel-800">
                <span className="font-bold text-white">Top Liquidity Providers on ${safeSymbol}</span>
              </div>

              {topLiquidityProviders.length === 0 ? (
                <div className="p-5 text-center border border-dashed border-sentinel-800 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-slate-300">LP provider list not available</p>
                  <p className="text-2xs text-slate-500">
                    Identifying individual LP token holders and their lock or
                    burn status needs a query this platform does not perform.
                  </p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-numeric border-collapse">
                  <thead>
                    <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                      <th className="py-1.5 px-2">#</th>
                      <th className="py-1.5 px-2">LP Provider</th>
                      <th className="py-1.5 px-2">Pool Target</th>
                      <th className="py-1.5 px-2">LP Token Units</th>
                      <th className="py-1.5 px-2">Share %</th>
                      <th className="py-1.5 px-2">Value (USD)</th>
                      <th className="py-1.5 px-2 text-right">Lock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sentinel-800/60">
                    {topLiquidityProviders.map((lp) => (
                      <tr key={lp.rank} className="hover:bg-sentinel-800/40 transition">
                        <td className="py-2 px-2 font-mono text-slate-500 font-bold">#{lp.rank}</td>
                        <td className="py-2 px-2 font-mono">
                          <span className="font-bold text-white block">{lp.provider}</span>
                          <span className="text-2xs text-slate-400">{lp.tag}</span>
                        </td>
                        <td className="py-2 px-2 text-slate-300 font-mono text-2xs">{lp.pool}</td>
                        <td className="py-2 px-2 text-slate-300 font-mono text-2xs">{lp.lpTokens}</td>
                        <td className="py-2 px-2 font-bold text-emerald-400 font-mono">{lp.sharePct}</td>
                        <td className="py-2 px-2 font-bold text-white">{lp.valueUsd}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-2xs text-emerald-400">
                          {lp.lockStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: AUDIT (Routed to /api/v1/tokens/.../audit)                          */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-4" role="region" aria-label="Token audit">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span role="status">{auditData?.holderAuditPending ? 'Ownership audit queued — updates automatically.' : 'Audit refreshes automatically while this tab is visible.'}</span>
              <Button variant="ghost" size="sm" onClick={refreshAudit} disabled={auditRefreshing} aria-busy={auditRefreshing}>
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${auditRefreshing ? 'motion-safe:animate-spin' : ''}`} />
                Refresh audit
              </Button>
            </div>
            {auditError && <p role="alert" className="rounded-md border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-300">
              {auditError} {auditData ? 'Showing previous evidence as stale.' : 'No audit result is available.'} Use Refresh audit to retry.
            </p>}
            {!auditData ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono" role="status">
                {auditError ? 'Audit unavailable' : 'Loading token audit...'}
              </div>
            ) : (
            <>
            {/* Top 4 Core Metrics -- every value below is measured, not asserted.
                This tab used to render a fixed 14/100 risk score, "24.5%
                Cluster Top 10", "92.4% Authentic" and "0/12 Rugged" for every
                token, and never called /audit at all. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Ownership Concentration */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Top 10 Holder Concentration</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                </div>
                {(() => {
                  const pct = auditData.top10HoldersPct ?? auditData.holderTop10Pct;
                  if (pct === null) {
                    return <Badge variant="neutral" size="sm">Not available</Badge>;
                  }
                  if (auditData.top10Evidence.status !== 'measured') return <Badge variant="neutral" size="sm">{pct.toFixed(1)}% · {auditData.top10Evidence.status}</Badge>;
                  const variant = pct >= 40 ? 'risk-high' : pct >= 20 ? 'risk-med' : 'risk-low';
                  const label = pct >= 40 ? 'HIGH' : pct >= 20 ? 'MODERATE' : 'LOW';
                  return <Badge variant={variant} size="sm">{label} ({pct.toFixed(1)}% Top 10)</Badge>;
                })()}
                <p className="text-2xs text-slate-500 font-mono">Share of supply held by the ten largest accounts.</p>
                <p className="text-2xs text-slate-500 break-words">{auditData.top10Evidence.source} · {auditData.top10Evidence.status}{auditData.top10Evidence.observedAt ? ` · ${new Date(auditData.top10Evidence.observedAt).toLocaleTimeString()}` : ''}</p>
              </div>

              {/* Organic Demand */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Organic Demand</span>
                  <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                </div>
                {auditData.organicScore === null ? (
                  <div className="text-sm font-bold font-mono text-slate-500">Not available</div>
                ) : (
                  <div className={`text-base font-bold font-numeric ${
                    auditData.organicEvidence.status !== 'measured' ? 'text-slate-400'
                    : auditData.organicScoreLabel === 'high' ? 'text-emerald-400'
                    : auditData.organicScoreLabel === 'medium' ? 'text-amber-400'
                    : 'text-rose-400'
                  }`}>
                    {auditData.organicScore.toFixed(1)} / 100{auditData.organicEvidence.status !== 'measured' ? ` · ${auditData.organicEvidence.status}` : ''}
                  </div>
                )}
                <p className="text-2xs text-slate-500 font-mono">
                  Jupiter&apos;s wash-trading filter{auditData.organicScoreLabel ? ` -- ${auditData.organicScoreLabel}` : ''}.
                </p>
              </div>

              {/* Creator History */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Creator History</span>
                  <Award className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <div className="text-sm font-bold font-mono text-slate-200">
                  {auditData.devMints === null
                    ? 'Not available'
                    : `${auditData.devMigrations ?? '?'}/${auditData.devMints} reached a pool`}
                </div>
                <p className="text-2xs text-slate-500 font-mono">
                  {auditData.migrationRatePct === null
                    ? 'Deployer mint history from Jupiter.'
                    : `${auditData.migrationRatePct.toFixed(2)}% of this deployer's launches migrated.`}
                </p>
                <p className="text-2xs text-slate-500">History: {auditData.historyEvidence.status}</p>
              </div>

              {/* Liquidity -- the same figure the tab badge already shows.
                  This tile used to invent a "Max Safe Order: 45 SOL" price-
                  impact estimate for every token; estimating one for real
                  needs a per-DEX pool query this platform does not perform. */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Total Liquidity</span>
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold font-numeric text-sky-300">
                  {totalLiquidityDisplay ?? 'Not available'}
                </div>
                <p className="text-2xs text-slate-500 font-mono">Aggregate, from Jupiter. Per-pool depth is not queried.</p>
              </div>
            </div>

            {/* Deep Contract & Security Checklist -- a grey "Not verified"
                chip where nothing checks the claim, never a green one. */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3.5 space-y-2.5 text-xs">
              <span className="text-2xs font-bold text-white font-mono uppercase tracking-wider block">
                Contract & On-Chain Security
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-2xs">
                {([
                  ['Mint Authority', auditData.mintAuthorityDisabled, 'Revoked', 'ACTIVE', auditData.mintAuthorityEvidence],
                  ['Freeze Authority', auditData.freezeAuthorityDisabled, 'Revoked', 'ACTIVE', auditData.freezeAuthorityEvidence],
                  ['LP Burn Status', auditData.lpTokensBurned, 'Burnt', 'Not burnt', undefined],
                  ['Honeypot / Tax', auditData.honeypotTaxZero, 'Clean', 'Tax detected', undefined],
                ] as const).map(([label, value, passLabel, failLabel, evidence]) => (
                  <div
                    key={label}
                    title={evidence ? `${evidence.source} · ${evidence.status} · ${evidence.observedAt || 'No observation'}${evidence.reason ? ` · ${evidence.reason}` : ''}` : 'No verification is performed for this check.'}
                    className={`flex items-center gap-1.5 p-2 rounded-lg bg-sentinel-950 border ${
                      value === null || evidence?.status !== 'measured' ? 'border-sentinel-800' : value ? 'border-emerald-900/60' : 'border-rose-900/60'
                    }`}
                  >
                    {value === null || evidence?.status !== 'measured' ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    ) : value ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                    <span className={value === null ? 'text-slate-500' : 'text-slate-300'}>
                      {label}: {value === null ? 'Not verified' : `${value ? passLabel : failLabel}${evidence?.status !== 'measured' ? ` · ${evidence?.status ?? 'unavailable'}` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-2xs text-slate-500 font-mono">
                Mint and freeze authority are read from the mint account. LP-burn status and honeypot/tax behavior
                are not checked by this platform -- they show &quot;Not verified&quot; rather than an assumed pass.
              </p>
            </div>

            {/* Holder-profile audit -- the same measurement behind the
                Discover cards&apos; audit pills. */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3.5 space-y-2">
              <span className="text-2xs font-bold text-white font-mono uppercase tracking-wider block">
                Holder Profile
              </span>
              <AuditPills
                top10HoldingsPct={auditData.holderTop10Pct ?? undefined}
                devHoldingsPct={auditData.devBalancePct ?? undefined}
                sniperPercentage={auditData.snipersPct ?? undefined}
                insiderHoldingsPct={auditData.insidersPct ?? undefined}
                bundlerPercentage={auditData.bundlersPct ?? undefined}
                pending={auditData.holderAuditPending}
                evidence={auditData.ownershipEvidence}
                evidenceByMetric={{ dev: auditData.devBalanceEvidence }}
                alwaysShow
              />
              <p className="text-2xs text-slate-400 break-words">{auditData.ownershipEvidence.source} · {auditData.ownershipEvidence.status}
                {auditData.ownershipEvidence.observedAt ? ` · observed ${new Date(auditData.ownershipEvidence.observedAt).toLocaleTimeString()}` : ''}
                {auditData.ownershipEvidence.reason ? ` · ${auditData.ownershipEvidence.reason}` : ''}
              </p>
              <RugRiskPill risk={auditData.rugRisk} ownershipEvidence={auditData.ownershipEvidence} securityEvidence={auditData.securityEvidence} liquidityEvidence={auditData.liquidityEvidence} />
            </div>
            </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: HOLDERS (Routed to /api/v1/tokens/.../holders)                      */}
        {/* ========================================================================= */}
        {activeTab === 'holders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-sentinel-800">
              <span className="font-bold text-white">Top {topHolders.length > 0 ? topHolders.length : ''} Token Holders</span>
              <span className="font-mono text-2xs">
                {holdersTop10Pct === null
                  ? 'Concentration unavailable'
                  : `Top 10 hold ${holdersTop10Pct.toFixed(2)}% of supply`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                    <th className="py-1.5 px-2">#</th>
                    <th className="py-1.5 px-2">Address</th>
                    <th className="py-1.5 px-2">Tag</th>
                    <th className="py-1.5 px-2">Balance</th>
                    <th className="py-1.5 px-2">% Supply</th>
                    <th className="py-1.5 px-2 text-right">Value USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {topHolders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs font-mono text-slate-500">
                        Loading holders…
                      </td>
                    </tr>
                  )}
                  {topHolders.map((h) => (
                    <tr key={h.rank} className="hover:bg-sentinel-800/40 transition">
                      <td className="py-2 px-2 font-mono text-slate-500 font-bold">{h.rank}</td>
                      <td className="py-2 px-2 font-mono text-slate-300">
                        <button onClick={() => handleCopy(h.fullAddress ?? h.address)} className="hover:text-sky-400 inline-flex items-center gap-1">
                          <span>{h.address}</span>
                          <Copy className="h-2.5 w-2.5 opacity-60" />
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded text-2xs font-mono font-bold bg-sentinel-800 text-sky-300 border border-sentinel-700">
                          {h.tag}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-slate-200">{h.balance}</td>
                      <td className="py-2 px-2 font-bold text-emerald-400 font-mono">{h.percent}</td>
                      <td className="py-2 px-2 text-right font-bold text-white">{h.valueUsd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: TOP TRADERS (Routed to /api/v1/tokens/.../top-traders)              */}
        {/* ========================================================================= */}
        {activeTab === 'top-traders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-sentinel-800">
              <span className="font-bold text-white">Most Active Traders on ${safeSymbol}</span>
              {/* Was "Ranked by Realized PnL" over Win Rate / Profit / ROI
                  columns the endpoint returns null for. These are the flows
                  the recent tape actually shows. */}
              <span className="font-mono text-2xs">
                {topTradersMeta ? `By trade count · last ${topTradersMeta.trades} trades` : 'By trade count'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                    <th className="py-1.5 px-2">Rank</th>
                    <th className="py-1.5 px-2">Wallet</th>
                    <th className="py-1.5 px-2">Trades (B / S)</th>
                    <th className="py-1.5 px-2">Bought</th>
                    <th className="py-1.5 px-2">Sold</th>
                    <th className="py-1.5 px-2 text-right">Net Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {topTraders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs font-mono text-slate-500">
                        {topTradersMeta ? 'No trades found for this token yet.' : 'Loading traders…'}
                      </td>
                    </tr>
                  )}
                  {topTraders.map((t) => (
                    <tr key={t.fullWallet ?? t.rank} className="hover:bg-sentinel-800/40 transition">
                      <td className="py-2 px-2 font-mono font-bold text-amber-400">#{t.rank}</td>
                      <td className="py-2 px-2 font-mono text-slate-300">
                        <button
                          onClick={() => handleCopy(t.fullWallet ?? t.wallet)}
                          className="hover:text-sky-300 inline-flex items-center gap-1"
                        >
                          <span>{t.wallet}</span>
                          <Copy className="h-2.5 w-2.5 opacity-60" />
                        </button>
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-300">
                        {t.totalTrades}{' '}
                        <span className="text-slate-500">
                          (<span className="text-emerald-400">{t.buys}</span> / <span className="text-rose-400">{t.sells}</span>)
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-emerald-400">{tapeUsd(t.buyVolumeUsd)}</td>
                      <td className="py-2 px-2 font-bold text-rose-400">{tapeUsd(t.sellVolumeUsd)}</td>
                      <td
                        className={`py-2 px-2 text-right font-bold font-mono ${
                          (t.netFlowUsd ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                        title="USD sold minus USD bought over the window. Positive means the wallet took money out."
                      >
                        {t.netFlowUsd === null || t.netFlowUsd === undefined
                          ? '—'
                          : `${t.netFlowUsd >= 0 ? '+' : '-'}${tapeUsd(Math.abs(t.netFlowUsd))}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: DEV TOKENS (100)                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'dev-tokens' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80 text-xs">
              <div>
                <span className="text-slate-400 font-mono text-2xs block">DEVELOPER WALLET</span>
                <span className="font-bold text-white font-mono">{devHistory.creator}</span>
              </div>
              <div>
                <span className="text-slate-400 font-mono text-2xs block">TOTAL LAUNCHES</span>
                <span className="font-bold text-sky-300 font-numeric">
                  {devHistory.totalCreated === null
                    ? 'n/a'
                    : `${devHistory.totalCreated.toLocaleString()} Tokens`}
                </span>
              </div>
              <div>
                {/* Was "0 Rugged (100% Clean)", hardcoded — a clean record
                    asserted for every deployer on the platform. Outcomes are
                    not tracked, so the honest figure is how many reached a
                    pool at all. */}
                <span className="text-slate-400 font-mono text-2xs block">REACHED A POOL</span>
                <span className="font-bold text-slate-200 font-numeric">
                  {devHistory.migratedCount === null
                    ? 'n/a'
                    : devHistory.migratedCount.toLocaleString()}
                </span>
              </div>
              <div>
                {/* Was "98/100 (Tier 1 Verified)" — a score nothing computed. */}
                <span className="text-slate-400 font-mono text-2xs block">MIGRATION RATE</span>
                <span className="font-bold text-slate-200 font-mono">
                  {devHistory.migrationRatePct === null
                    ? 'n/a'
                    : `${devHistory.migrationRatePct.toFixed(2)}%`}
                </span>
              </div>
            </div>

            {devHistory.recentLaunches.length === 0 ? (
              <div className="p-5 text-center border border-dashed border-sentinel-800 rounded-xl space-y-1">
                <p className="text-xs font-bold text-slate-300">Launch timeline not collected</p>
                <p className="text-2xs text-slate-500">
                  Listing this deployer&apos;s previous tokens needs a
                  signature-history walk that is not performed. The counts above
                  are real; the per-launch table is not available.
                </p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                    <th className="py-1.5 px-2">Token</th>
                    <th className="py-1.5 px-2">Launch Date</th>
                    <th className="py-1.5 px-2">ATH Market Cap</th>
                    <th className="py-1.5 px-2">Status</th>
                    <th className="py-1.5 px-2 text-right">Rug Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {devHistory.recentLaunches.map((item) => (
                    <tr key={item.symbol} className="hover:bg-sentinel-800/40 transition">
                      <td className="py-2 px-2 font-bold text-white flex items-center gap-1.5">
                        <span className="text-sky-400">{item.symbol}</span>
                        <span className="text-slate-400 text-2xs font-normal">({item.name})</span>
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-400">{item.launchDate}</td>
                      <td className="py-2 px-2 font-bold text-slate-200">{item.athMarketCap}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded text-2xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-400 font-mono">{item.rugRisk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default AxiomChartTabs;
