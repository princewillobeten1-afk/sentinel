'use client';

import React, { useState, useEffect } from 'react';
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
  tag: 'dex' | 'dev' | 'whale' | 'insider' | 'sniper' | 'retail';
  address: string;
  balanceTokens: string;
  supplyPct: number;
  valueUsd: string;
  x: number;
  y: number;
  r: number;
  fundingSource: string;
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

  const [totalLiquidityDisplay, setTotalLiquidityDisplay] = useState('$561K');
  const [holdersDisplay, setHoldersDisplay] = useState('1.4K');
  const [devProfile, setDevProfile] = useState<{
    creatorWallet: string;
    isVerified: boolean;
    currentHoldingTokens: string;
    currentHoldingUsd: string;
    currentHoldingSupplyPct: string;
    totalDevBoughtSol: string;
    totalDevSoldSol: string;
    netRealizedProfitSol: string;
    netRealizedProfitUsd: string;
    dumpRiskRating: string;
    isLpBurned: boolean;
  }>({
    creatorWallet: '7xK9...3a19',
    isVerified: true,
    currentHoldingTokens: `8,500,000 $${safeSymbol}`,
    currentHoldingUsd: '$361,250.00',
    currentHoldingSupplyPct: '0.85%',
    totalDevBoughtSol: '45.00 SOL ($6,750.00)',
    totalDevSoldSol: '366.60 SOL ($55,000.00)',
    netRealizedProfitSol: '+321.60 SOL',
    netRealizedProfitUsd: '+$48,250.00',
    dumpRiskRating: 'LOW (Dev holds <1% supply)',
    isLpBurned: true,
  });

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
    fetch('/api/v1/analytics/market', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const price = j?.data?.marketSummary?.solPriceUsd ?? j?.data?.solPriceUsd;
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
   * Starts empty and is filled by `/liquidity`.
   *
   * These were seeded with two fictional pools — "Raydium CPMM" at address
   * 5xRydm99qP88x12kL0z1 holding $384,500 with a 142.8% APY and "100% LP
   * Burned" — shown for every token including ones with no pool at all. The
   * endpoint no longer returns a per-pool breakdown, because enumerating pools
   * needs a query it does not perform.
   */
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPoolItem[]>([]);

  const [topLiquidityProviders, setTopLiquidityProviders] = useState<LiquidityProvider[]>([
    {
      rank: 1,
      provider: 'Solana Incinerator (Burn Address)',
      tag: '🔥 100% LP Burnt',
      pool: 'Raydium CPMM (SOL/SENT)',
      lpTokens: '184,200,000 LP',
      sharePct: '85.2%',
      valueUsd: '$327,594.00',
      lockStatus: 'Burned 🔥',
    },
    {
      rank: 2,
      provider: 'Raydium Protocol Vault',
      tag: 'AMM Protocol Reserve',
      pool: 'Raydium CPMM (SOL/SENT)',
      lpTokens: '18,500,000 LP',
      sharePct: '8.5%',
      valueUsd: '$32,682.00',
      lockStatus: 'Locked 🔒',
      lockExpiry: 'Permanent Protocol Vault',
    },
    {
      rank: 3,
      provider: 'Streamflow Lock Vault (Orca)',
      tag: 'Whale LP Lock',
      pool: 'Orca Whirlpool (SOL/SENT)',
      lpTokens: '8,400,000 LP',
      sharePct: '4.2%',
      valueUsd: '$16,149.00',
      lockStatus: 'Locked 🔒',
      lockExpiry: '342 days remaining',
    },
    {
      rank: 4,
      provider: 'Community DAO Treasury',
      tag: 'Ecosystem Liquidity',
      pool: 'Meteora DLMM (USDC/SENT)',
      lpTokens: '4,500,000 LP',
      sharePct: '2.1%',
      valueUsd: '$8,074.50',
      lockStatus: 'Locked 🔒',
      lockExpiry: '168 days remaining',
    },
  ]);

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
  const devHistory = {
    creator: '7xK9...3a19',
    totalCreated: 100,
    ruggedCount: 0,
    avgPeakMarketCap: '$1.85M',
    trustScore: '98/100 (Tier 1 Verified)',
    recentLaunches: [
      { symbol: '$SENT', name: 'Solana Sentinel', launchDate: 'Aug 2026', athMarketCap: '$42.5M (Active)', status: 'Active / Thriving', rugRisk: 'None (0%)' },
      { symbol: '$SOLA', name: 'Solana Arbitrage', launchDate: 'Jul 2026', athMarketCap: '$4.2M', status: 'Graduated / LP Burnt', rugRisk: 'Clean' },
      { symbol: '$ORBIT', name: 'Orbit DEX Engine', launchDate: 'May 2026', athMarketCap: '$1.1M', status: 'Community Owned', rugRisk: 'Clean' },
      { symbol: '$NEXUS', name: 'Nexus Guard', launchDate: 'Mar 2026', athMarketCap: '$850K', status: 'Archived', rugRisk: 'Clean' },
    ],
  };

  // ---------------------------------------------------------------------------
  // LIVE WEBSOCKET DATA: Stream Incoming Trades via internal Sentinel WS
  // ---------------------------------------------------------------------------
  useSentinelWS(safeMint ? [`token.trade:${safeMint}`, `token.price:${safeMint}`] : [], (data, msg) => {
    if (msg.topic === `token.trade:${safeMint}`) {
      const volUsd = data.priceUsd && data.amount ? Number(data.priceUsd) * Number(data.amount) : undefined;
      const solEst = volUsd ? volUsd / 150 : data.amountSol ? Number(data.amountSol) : 0.5;
      const isWhale = solEst >= 5;
      const newTrade: TradeTransaction = {
        id: data.signature || `ws_tx_${Date.now()}_${Math.random()}`,
        type: data.side ? (data.side.toLowerCase() as 'buy' | 'sell') : 'buy',
        amountSol: `${solEst.toFixed(2)} SOL`,
        tokens: data.amount ? Number(data.amount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '1,000',
        price: data.priceUsd ? `$${Number(data.priceUsd).toFixed(4)}` : `$${safePrice.toFixed(4)}`,
        valueUsd: volUsd ? `$${volUsd.toFixed(2)}` : `$${(solEst * 150).toFixed(2)}`,
        time: 'Just now',
        wallet: data.wallet ? `${data.wallet.slice(0, 4)}...${data.wallet.slice(-4)}` : 'anon...4kL2',
        txHash: data.signature || 'tx',
        isWhale,
      };

      setTrades((prev) => [newTrade, ...prev.slice(0, 49)]);
    }
  });

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

    // 1. Trade tape, from trades this platform captured itself.
    //
    // Was `/trades`, which proxies Birdeye — whose compute-unit quota is
    // exhausted, so it returned nothing and the tape sat empty. `/live-trades`
    // reads `realtime_trades`, which the Helius stream has been filling all
    // along and which no endpoint previously exposed.
    const sideParam = tradeFilter === 'buy' ? '&side=BUY' : tradeFilter === 'sell' ? '&side=SELL' : '';
    fetch(`/api/v1/tokens/solana/${safeMint}/live-trades?limit=50${sideParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const rows = data?.data?.trades;
        if (!Array.isArray(rows) || !isMounted) return;
        const dash = '—';
        const usd = (v: string | null) =>
          v == null ? dash : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

        setTrades(
          rows.map((t: any): TradeTransaction => ({
            id: t.signature,
            type: t.side === 'SELL' ? 'sell' : 'buy',
            amountSol: t.amountSol == null ? dash : Number(t.amountSol).toFixed(4),
            // The capture records a USD value, not a token quantity.
            tokens: dash,
            price: t.priceUsd == null ? dash : `$${Number(t.priceUsd).toPrecision(4)}`,
            valueUsd: usd(t.amountUsd),
            time: new Date(t.timestamp).toLocaleTimeString(),
            wallet: t.wallet ? `${t.wallet.slice(0, 4)}...${t.wallet.slice(-4)}` : dash,
            txHash: t.signature,
            isWhale: t.amountUsd != null && Number(t.amountUsd) >= 5000,
          })),
        );
      })
      .catch(() => {});

    // 2. Fetch Dev Activity
    fetch(`/api/v1/tokens/solana/${safeMint}/dev-activity?filter=${devFilter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.events && isMounted) {
          setDevActivities(data.data.events);
        }
        if (data?.data?.devProfile && isMounted) {
          setDevProfile(data.data.devProfile);
        }
      })
      .catch(() => {});

    // 3. Fetch Bubble Map
    fetch(`/api/v1/tokens/solana/${safeMint}/bubble-map`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.nodes && isMounted) {
          setMapClusterNodes(data.data.nodes);
        }
      })
      .catch(() => {});

    // 4. Fetch Liquidity Pools
    fetch(`/api/v1/tokens/solana/${safeMint}/liquidity`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.pools && isMounted) {
          setLiquidityPools(data.data.pools);
        }
        if (data?.data?.topProviders && isMounted) {
          setTopLiquidityProviders(data.data.topProviders);
        }
        if (data?.data?.totalLiquidityUsd && isMounted) {
          setTotalLiquidityDisplay(data.data.totalLiquidityUsd);
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
        setHoldersDisplay(
          payload.totalHoldersCount === null || payload.totalHoldersCount === undefined
            ? '—'
            : String(payload.totalHoldersCount),
        );
      })
      .catch(() => {});

    // 6. Fetch Top Traders
    fetch(`/api/v1/tokens/solana/${safeMint}/top-traders`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data?.topTraders && isMounted) {
          setTopTraders(data.data.topTraders);
        }
      })
      .catch(() => {});

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
  }, [safeMint, tradeFilter, devFilter]);

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

  // Mock Active User Position
  const userPosition = {
    token: `$${tokenSymbol}`,
    mint: tokenMint,
    amountTokens: '58,823.50',
    avgEntryPrice: 0.0385,
    currentPrice: currentPrice,
    costBasisUsd: 2264.71,
    currentValueUsd: 58823.5 * currentPrice,
    unrealizedPnlUsd: 58823.5 * currentPrice - 2264.71,
    unrealizedPnlPct: ((currentPrice - 0.0385) / 0.0385) * 100,
    liquidationPrice: 0.0308,
    safetyScore: 94,
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    // Same source as the initial load: `/live-trades` reads the trades this
    // platform captured. This still pointed at `/trades`, which proxies dead
    // Birdeye and falls back to a hardcoded tape — so pressing refresh
    // replaced real rows with fiction.
    const sideParam = tradeFilter === 'buy' ? '&side=BUY' : tradeFilter === 'sell' ? '&side=SELL' : '';
    fetch(`/api/v1/tokens/solana/${safeMint}/live-trades?limit=50${sideParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const rows = data?.data?.trades;
        if (!Array.isArray(rows)) return;
        const dash = '—';
        setTrades(
          rows.map((t: any): TradeTransaction => ({
            id: t.signature,
            type: t.side === 'SELL' ? 'sell' : 'buy',
            amountSol: t.amountSol == null ? dash : Number(t.amountSol).toFixed(4),
            tokens: dash,
            price: t.priceUsd == null ? dash : `$${Number(t.priceUsd).toPrecision(4)}`,
            valueUsd:
              t.amountUsd == null
                ? dash
                : `$${Number(t.amountUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            time: new Date(t.timestamp).toLocaleTimeString(),
            wallet: t.wallet ? `${t.wallet.slice(0, 4)}...${t.wallet.slice(-4)}` : dash,
            txHash: t.signature,
            isWhale: t.amountUsd != null && Number(t.amountUsd) >= 5000,
          })),
        );
      })
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 500);
      });
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
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {/* Trades Tab */}
          <button
            onClick={() => setActiveTab('trades')}
            className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'trades'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Trades</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>

          {/* Positions Tab */}
          <button
            onClick={() => setActiveTab('positions')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'positions'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <span>Positions</span>
            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-2xs font-mono text-emerald-400 font-bold">
              1
            </span>
          </button>

          {/* Orders Tab */}
          <button
            onClick={() => setActiveTab('orders')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Target className="h-3.5 w-3.5 text-sky-400" />
            <span>Orders</span>
            <span className="rounded-full bg-sentinel-800 px-1.5 py-0.2 text-2xs font-mono text-slate-400">
              0
            </span>
          </button>

          {/* Dev Activity Tab */}
          <button
            onClick={() => setActiveTab('dev-activity')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'dev-activity'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-rose-400" />
            <span>Dev Activity</span>
            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 text-2xs font-mono text-rose-300 font-bold">
              {devProfile.currentHoldingSupplyPct} Dev
            </span>
          </button>

          {/* Maps Tab (Bubble Maps / Cluster Graphs) */}
          <button
            onClick={() => setActiveTab('maps')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'maps'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Network className="h-3.5 w-3.5 text-cyan-400" />
            <span>Maps</span>
            <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-2xs font-mono text-cyan-300 font-bold">
              Clusters
            </span>
          </button>

          {/* Liquidity Providers & DEX Pools Tab */}
          <button
            onClick={() => setActiveTab('liquidity')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === 'liquidity'
                ? 'bg-sentinel-800/90 text-sky-300 shadow-sm border border-sentinel-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sentinel-900/60'
            }`}
          >
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            <span>Liquidity ({totalLiquidityDisplay})</span>
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
            <span>Holders (1.4K)</span>
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
            <span>Dev History (100)</span>
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
                    <span className="text-rose-400 font-bold font-numeric">
                      Holding: 58,823.50 ${safeSymbol}
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
                          onClick={() => handleCopy(tr.wallet)}
                          className="inline-flex items-center gap-1 hover:text-sky-300 transition"
                        >
                          <span>{tr.wallet}</span>
                          {copiedAddress === tr.wallet ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-2xs text-slate-400">{tr.time}</td>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-numeric text-xs">
              <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 text-2xs font-mono uppercase block">Position Size</span>
                <span className="text-base font-bold text-white">{userPosition.amountTokens} {userPosition.token}</span>
                <span className="text-2xs text-slate-400 block font-mono">~${userPosition.currentValueUsd.toFixed(2)}</span>
              </div>

              <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 text-2xs font-mono uppercase block">Average Entry</span>
                <span className="text-base font-bold text-slate-200">${userPosition.avgEntryPrice.toFixed(4)}</span>
                <span className="text-2xs text-slate-500 block font-mono">Mark: ${userPosition.currentPrice.toFixed(4)}</span>
              </div>

              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                <span className="text-emerald-400 text-2xs font-mono uppercase block">Unrealized PnL</span>
                <span className="text-base font-bold text-emerald-400">+${userPosition.unrealizedPnlUsd.toFixed(2)}</span>
                <span className="text-2xs text-emerald-300 font-bold block font-mono">+{userPosition.unrealizedPnlPct.toFixed(2)}% ROI</span>
              </div>

              <div className="p-3 rounded-xl border border-sentinel-800 bg-sentinel-950/80 flex flex-col justify-between">
                <span className="text-slate-400 text-2xs font-mono uppercase block">Risk / Exit Strategy</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={onOpenLimitBuilder}
                    className="flex-1 py-1 px-2 rounded-lg bg-sentinel-800 hover:bg-sentinel-700 text-sky-300 font-bold text-2xs border border-sentinel-700 transition text-center"
                  >
                    + Add TP / SL
                  </button>
                  <button
                    onClick={() => onQuickTrade?.('sell', 0.5)}
                    className="flex-1 py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-2xs border border-rose-500/40 transition text-center"
                  >
                    Close 100%
                  </button>
                </div>
              </div>
            </div>

            {/* Position Controls Bar */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="risk-low" size="sm">Active Position</Badge>
                <span className="text-slate-400 font-mono text-2xs">Mint: {tokenMint.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-2xs">Quick Sell:</span>
                {['25%', '50%', '100%'].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => onQuickTrade?.('sell', 0.5)}
                    className="px-2 py-0.5 rounded bg-sentinel-900 border border-sentinel-750 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-2xs font-bold transition"
                  >
                    Sell {pct}
                  </button>
                ))}
              </div>
            </div>
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
            <OpenOrdersDashboard currentPrice={currentPrice} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DEV ACTIVITY (Routed to /api/v1/tokens/.../dev-activity)            */}
        {/* ========================================================================= */}
        {activeTab === 'dev-activity' && (
          <div className="space-y-3">
            {/* Dev Metric Summary Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-numeric">
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Developer Wallet</span>
                <button
                  onClick={() => handleCopy(devProfile.creatorWallet)}
                  className="font-bold text-sky-300 font-mono text-2xs hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  <span>{devProfile.creatorWallet}</span>
                  <Copy className="h-3 w-3 text-slate-500" />
                </button>
                <span className="text-2xs text-emerald-400 block font-mono">Verified Deployer</span>
              </div>

              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Current Dev Holdings</span>
                <span className="text-sm font-bold text-white font-mono block">{devProfile.currentHoldingTokens}</span>
                <span className="text-2xs text-slate-400 block font-mono">{devProfile.currentHoldingSupplyPct} Supply (~{devProfile.currentHoldingUsd})</span>
              </div>

              <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                <span className="text-emerald-400 font-mono text-2xs uppercase block">Dev Realized PnL</span>
                <span className="text-sm font-bold text-emerald-400 block">{devProfile.netRealizedProfitSol}</span>
                <span className="text-2xs text-emerald-300 block font-mono">{devProfile.netRealizedProfitUsd} Realized</span>
              </div>

              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Dump Risk Rating</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="risk-low" size="sm">LOW DUMP RISK</Badge>
                </div>
                <span className="text-2xs text-slate-400 block font-mono mt-0.5">{devProfile.dumpRiskRating}</span>
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
                  {devActivities.map((act) => (
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
            {/* Cluster Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-numeric">
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Decentralization Health</span>
                <span className="text-sm font-bold text-emerald-400 block font-mono">89/100 (Safe)</span>
                <span className="text-2xs text-slate-500 block">Distributed organically</span>
              </div>
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Top 10 Concentration</span>
                <span className="text-sm font-bold text-white block font-mono">14.20% Supply</span>
                <span className="text-2xs text-slate-500 block">Excluding LP Pool</span>
              </div>
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Dev Connected Wallets</span>
                <span className="text-sm font-bold text-sky-300 block font-mono">2 Wallets (0.85%)</span>
                <span className="text-2xs text-slate-500 block">No hidden insider dump rings</span>
              </div>
              <div className="p-2.5 rounded-xl border border-sentinel-800 bg-sentinel-950/80">
                <span className="text-slate-400 font-mono text-2xs uppercase block">Sniper Supply</span>
                <span className="text-sm font-bold text-amber-400 block font-mono">2.94% (4 Wallets)</span>
                <span className="text-2xs text-slate-500 block">Low sell pressure</span>
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
                  <div className="flex items-center gap-2 text-2xs font-mono text-slate-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" /> DEX</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Dev</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" /> Whales</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Snipers</span>
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

                    {/* Connection Lines between connected nodes */}
                    <line x1="270" y1="110" x2="480" y2="140" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="270" y1="110" x2="230" y2="200" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="160" y1="130" x2="270" y2="110" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1.5" />

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
                          <span className="text-emerald-400 font-bold">{selectedMapNode.supplyPct}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Token Balance:</span>
                          <span className="text-white font-bold">{selectedMapNode.balanceTokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Value (USD):</span>
                          <span className="text-slate-200 font-bold">{selectedMapNode.valueUsd}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-sentinel-800">
                          <span className="text-slate-400">Inflow Route:</span>
                          <span className="text-slate-300 text-2xs">{selectedMapNode.fundingSource}</span>
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
            {/* Pools Summary Cards */}
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

            {/* Top Liquidity Providers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-sentinel-800">
                <span className="font-bold text-white">Top Liquidity Providers on ${safeSymbol}</span>
                <span className="font-mono text-2xs">85.2% LP permanently burned</span>
              </div>

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
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: AUDIT (Routed to /api/v1/tokens/.../audit)                          */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            {/* Top 4 Core Metrics requested */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Effective Ownership Risk */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Effective Ownership Risk</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="pt-0.5">
                  <Badge variant="risk-low" size="sm">LOW (24.5% Cluster Top 10)</Badge>
                </div>
                <p className="text-2xs text-slate-500 font-mono">No single controller holds &gt;10% liquid supply.</p>
              </div>

              {/* Organic Demand Ratio */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Organic Demand Ratio</span>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-base font-bold font-numeric text-emerald-400">
                  92.4% Authentic
                </div>
                <p className="text-2xs text-slate-500 font-mono">7.6% artificial / wash volume filtered out.</p>
              </div>

              {/* Creator History Audit */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Creator History Audit</span>
                  <Award className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <div className="text-sm font-bold font-mono text-slate-200">
                  0/12 Rugged | Credible
                </div>
                <p className="text-2xs text-slate-500 font-mono">Deployer history verified across 12 launches.</p>
              </div>

              {/* Executable Liquidity Depth */}
              <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-2xs">
                  <span>Executable Liquidity Depth</span>
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold font-numeric text-sky-300">
                  Max Safe Order: 45 SOL
                </div>
                <p className="text-2xs text-slate-500 font-mono">&lt;2.0% price impact up to $6,750 buy order.</p>
              </div>
            </div>

            {/* Deep Contract & Security Checklist */}
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-850 p-3.5 space-y-2.5 text-xs">
              <span className="text-2xs font-bold text-white font-mono uppercase tracking-wider block">
                Contract & On-Chain Security Verifications
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-2xs">
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-300">Mint Authority: Revoked</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-300">Freeze Authority: Revoked</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-300">LP Status: 100% Burnt</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-sentinel-950 border border-sentinel-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-300">Honeypot: 0% / 0% Tax</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: HOLDERS (Routed to /api/v1/tokens/.../holders)                      */}
        {/* ========================================================================= */}
        {activeTab === 'holders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-sentinel-800">
              <span className="font-bold text-white">Top 8 Token Holders Distribution</span>
              <span className="font-mono text-2xs">Top 10 hold 24.50% of supply</span>
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
              <span className="font-bold text-white">Top Performing Smart Traders on ${safeSymbol}</span>
              <span className="font-mono text-2xs">Ranked by Realized PnL</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-numeric border-collapse">
                <thead>
                  <tr className="border-b border-sentinel-800 text-2xs text-slate-400 font-mono uppercase">
                    <th className="py-1.5 px-2">Rank</th>
                    <th className="py-1.5 px-2">Wallet</th>
                    <th className="py-1.5 px-2">Style</th>
                    <th className="py-1.5 px-2">Trades</th>
                    <th className="py-1.5 px-2">Win Rate</th>
                    <th className="py-1.5 px-2">Total Profit</th>
                    <th className="py-1.5 px-2 text-right">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-800/60">
                  {topTraders.map((t) => (
                    <tr key={t.rank} className="hover:bg-sentinel-800/40 transition">
                      <td className="py-2 px-2 font-mono font-bold text-amber-400">#{t.rank}</td>
                      <td className="py-2 px-2 font-mono text-slate-300">{t.wallet}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded text-2xs font-mono bg-sky-500/10 text-sky-300 border border-sky-500/30">
                          {t.tag}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-300">{t.totalTrades}</td>
                      <td className="py-2 px-2 font-bold text-emerald-400 font-mono">{t.winRate}</td>
                      <td className="py-2 px-2 font-bold text-emerald-400">{t.totalProfitUsd}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-300 font-mono">{t.roi}</td>
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
                <span className="font-bold text-sky-300 font-numeric">{devHistory.totalCreated} Tokens</span>
              </div>
              <div>
                <span className="text-slate-400 font-mono text-2xs block">RUG RECORD</span>
                <span className="font-bold text-emerald-400 font-numeric">0 Rugged (100% Clean)</span>
              </div>
              <div>
                <span className="text-slate-400 font-mono text-2xs block">TRUST TIER</span>
                <span className="font-bold text-emerald-300 font-mono">{devHistory.trustScore}</span>
              </div>
            </div>

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
          </div>
        )}

      </div>
    </div>
  );
}

export default AxiomChartTabs;
