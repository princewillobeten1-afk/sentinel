'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Compass,
  Wallet,
  ShieldAlert,
  Rocket,
  LayoutDashboard,
  Zap,
  Settings,
  Command,
  User,
  History,
  X,
  Sparkles,
  PieChart,
  Bookmark,
  BrainCircuit,
  BarChart3,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Send,
  BarChart2,
  TrendingUp,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { formatCompactUsd, formatTokenPrice } from '@/lib/discovery/format';
import { useRouter } from 'next/navigation';
import { viewRouteMap } from '@/components/layout/sidebar';
import { useAppState, useAppActions, type AppView } from '@/lib/store';
import { useDebouncedValue } from '@/lib/hooks/use-debounce';

export type SearchCategory = 'all' | 'tokens' | 'wallets' | 'creators' | 'launches' | 'commands';

export interface SearchTokenItem {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  chain?: string;
  source?: string;
  logoUrl?: string;
  logoURI?: string;
  priceUsd?: string | number;
  priceChange24h?: number;
  marketCapUsd?: string | number;
  liquidityUsd?: string | number;
  volume24hUsd?: string | number;
  riskRating?: 'low' | 'med' | 'high' | 'critical';
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
}

const STORAGE_RECENT_SEARCHES_KEY = 'sentinel_recent_searches_v2';

export function CommandPalette() {
  const router = useRouter();
  const { isCommandPaletteOpen, primaryWallet, connectedWallet } = useAppState();
  const {
    setCommandPaletteOpen,
    setActiveView,
    setQuickBuyOpen,
    setHotkeysOpen,
    setWalletModalOpen,
    setSelectedToken,
    addNotification,
  } = useAppActions();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');
  const [liveTokens, setLiveTokens] = useState<SearchTokenItem[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>([
    '$SENT',
    '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    'CyberBank',
    'Sanic',
  ]);

  const debouncedQuery = useDebouncedValue(query, 180);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_RECENT_SEARCHES_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentSearches(parsed.slice(0, 8));
          }
        }
      } catch {
        // Fallback to default
      }
    }
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, []);

  const clearRecent = () => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_RECENT_SEARCHES_KEY);
      } catch {}
    }
  };

  // Navigational Commands
  const navCommands: Array<{
    id: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    shortcut: string;
  }> = [
    {
      id: 'cmd_discover',
      label: 'Go to Token Discovery Screener',
      description: 'Explore live new launches, bonding curve migrations, and graduated pairs',
      icon: Compass,
      action: () => handleSelectNav('discover'),
      shortcut: 'G D',
    },
    {
      id: 'cmd_trade',
      label: 'Go to DEX Trade Terminal',
      description: 'Execute instant Solana swaps, limit orders, and candlestick charts',
      icon: Wallet,
      action: () => handleSelectNav('trade'),
      shortcut: 'G T',
    },
    {
      id: 'cmd_portfolio',
      label: 'Go to Portfolio & Net P&L',
      description: 'Review wallet balances, open token positions, and realized profit',
      icon: PieChart,
      action: () => handleSelectNav('portfolio'),
      shortcut: 'G P',
    },
    {
      id: 'cmd_watchlist',
      label: 'Go to Watchlist',
      description: 'View starred Solana tokens and set price alerts',
      icon: Bookmark,
      action: () => handleSelectNav('watchlist'),
      shortcut: 'G W',
    },
    {
      id: 'cmd_launchpad',
      label: 'Go to Token Launchpad',
      description: 'Deploy new tokens with anti-snipe protection and fair bonding curves',
      icon: Rocket,
      action: () => handleSelectNav('launchpad'),
      shortcut: 'G L',
    },
    {
      id: 'cmd_intelligence',
      label: 'Go to Blockchain Intelligence & Bubblemaps',
      description: 'Inspect cluster detection, insider wallet connections, and risk audits',
      icon: BrainCircuit,
      action: () => handleSelectNav('intelligence'),
      shortcut: 'G I',
    },
    {
      id: 'cmd_ai',
      label: 'Go to Sentinel AI Co-Pilot',
      description: 'Ask AI for market analysis, token safety scoring, and trend forecasts',
      icon: Sparkles,
      action: () => handleSelectNav('ai'),
      shortcut: 'G AI',
    },
    {
      id: 'cmd_quickbuy',
      label: 'Open Instant Quick Buy Swap',
      description: 'Fast one-click Solana swap execution modal',
      icon: Zap,
      action: () => {
        setCommandPaletteOpen(false);
        setQuickBuyOpen(true);
      },
      shortcut: 'B',
    },
    {
      id: 'cmd_wallet',
      label: 'Connect / Manage Solana Wallet',
      description: 'Phantom, Solflare, Backpack, or Sentinel Embedded Smart Wallet',
      icon: Wallet,
      action: () => {
        setCommandPaletteOpen(false);
        setWalletModalOpen(true);
      },
      shortcut: 'W',
    },
    {
      id: 'cmd_hotkeys',
      label: 'Open Keyboard Shortcuts Guide',
      description: 'View all pro-trader hotkeys and terminal shortcuts',
      icon: Command,
      action: () => {
        setCommandPaletteOpen(false);
        setHotkeysOpen(true);
      },
      shortcut: '?',
    },
    {
      id: 'cmd_settings',
      label: 'Go to Terminal Preferences',
      description: 'Configure RPC endpoints, slippage presets, and custom themes',
      icon: Settings,
      action: () => handleSelectNav('settings'),
      shortcut: 'G S',
    },
  ];

  // Dynamic Live Search Fetcher
  useEffect(() => {
    let cancelled = false;

    async function fetchSearchTokens() {
      setIsLoadingTokens(true);
      try {
        const qParam = encodeURIComponent(debouncedQuery.trim());
        const res = await fetch(`/api/v1/tokens/search?q=${qParam}&limit=30`);
        if (res.ok) {
          const json = await res.json();
          const items = json.data?.items || json.items || [];
          if (!cancelled) {
            setLiveTokens(items);
          }
        }
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        if (!cancelled) {
          setIsLoadingTokens(false);
        }
      }
    }

    fetchSearchTokens();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const matchQuery = (str: string) => str.toLowerCase().includes(query.toLowerCase().trim());

  const filteredCommands = navCommands.filter(
    (c) => matchQuery(c.label) || matchQuery(c.description) || matchQuery(c.shortcut)
  );

  const isSolanaAddress = useMemo(() => {
    const trimmed = query.trim();
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  }, [query]);

  const mockWallets = [
    { label: 'Smart Money Cluster #1', address: '4zW8YxKm3N1a84mP2xQ5wN3a19', balance: '1,420 SOL', reputation: 'Smart Money' },
    { label: 'Top Raydium Whale', address: '9xQeWvBs84mP2xQ5wN3a19K2xP5', balance: '8,650 SOL', reputation: 'Whale' },
    { label: 'Insider Deployer 7xK9', address: '7xK99zK8mP2xQ5wN3a19', balance: '42.8 SOL', reputation: 'Insider' },
  ];

  const mockCreators = [
    { name: 'Alpha Dev Team', address: '9pQ1xK2xP5wN1a84mP2xQ5wN3a19', trackRecord: '12 Tokens (0 Rugged)', reputation: 'Verified' },
    { name: 'Degen Creator X', address: '1aM3xK2xP5wN1a84mP2xQ5wN3a19', trackRecord: '5 Tokens (3 Rugged)', reputation: 'High Risk' },
  ];

  const filteredWallets = mockWallets.filter((w) => matchQuery(w.label) || matchQuery(w.address));
  const filteredCreators = mockCreators.filter((c) => matchQuery(c.name) || matchQuery(c.address));

  const hasAnyResults =
    ((selectedCategory === 'all' || selectedCategory === 'commands') && filteredCommands.length > 0) ||
    ((selectedCategory === 'all' || selectedCategory === 'tokens') && liveTokens.length > 0) ||
    ((selectedCategory === 'all' || selectedCategory === 'wallets') && (filteredWallets.length > 0 || isSolanaAddress)) ||
    ((selectedCategory === 'all' || selectedCategory === 'creators') && filteredCreators.length > 0);

  const handleSelectNav = (view: AppView) => {
    saveRecentSearch(`Go to ${view}`);
    setActiveView(view);
    setCommandPaletteOpen(false);
    setQuery('');
    const target = viewRouteMap[view] || `/${view}`;
    router.push(target);
  };

  const handleSelectTokenTrade = (token: SearchTokenItem) => {
    saveRecentSearch(token.symbol ? `$${token.symbol}` : token.mint);
    setSelectedToken({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoURI || token.logoUrl,
      priceUsd: String(token.priceUsd || '0'),
      marketCapUsd: String(token.marketCapUsd || '0'),
      liquidityUsd: String(token.liquidityUsd || '0'),
      chain: token.chain || 'solana',
    });
    setActiveView('trade');
    setCommandPaletteOpen(false);
    setQuery('');
    router.push(`/trade/${token.chain || 'solana'}/${token.mint}`);
  };

  const handleSelectTokenQuickBuy = (token: SearchTokenItem, e: React.MouseEvent) => {
    e.stopPropagation();
    saveRecentSearch(token.symbol ? `$${token.symbol}` : token.mint);
    setCommandPaletteOpen(false);
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: typeof token.priceUsd === 'number' ? `$${token.priceUsd}` : String(token.priceUsd || '$0.00'),
      mcap: typeof token.marketCapUsd === 'number' ? formatCompactUsd(token.marketCapUsd) : String(token.marketCapUsd || '$0'),
    });
  };

  const handleCopyCA = (mint: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  return (
    <Modal
      isOpen={isCommandPaletteOpen}
      onClose={() => {
        setCommandPaletteOpen(false);
        setQuery('');
      }}
      size="lg"
      className="p-0 border-slate-800/90 bg-[#070a0f] text-slate-100 select-none shadow-2xl rounded-2xl overflow-hidden"
    >
      {/* Search Input Bar */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-3.5 bg-slate-900/60 backdrop-blur">
        {isLoadingTokens ? (
          <Loader2 className="h-5 w-5 text-sky-400 animate-spin shrink-0" />
        ) : (
          <Search className="h-5 w-5 text-sky-400 shrink-0" />
        )}
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token name, symbol, Solana contract address (CA), or command..."
          className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 outline-none font-medium font-sans"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-2xs text-slate-400 font-mono border border-slate-700">
          ESC
        </kbd>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-slate-800/80 bg-[#0b0e14] font-mono text-2xs overflow-x-auto no-scrollbar">
        {(['all', 'tokens', 'commands', 'wallets', 'creators'] as SearchCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-md transition uppercase font-bold ${
              selectedCategory === cat
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="max-h-[62vh] overflow-y-auto p-3 space-y-3.5 font-sans">
        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <History className="h-3 w-3 text-slate-400" /> Recent Searches
              </span>
              <button onClick={clearRecent} className="text-slate-500 hover:text-rose-400 transition text-2xs">
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-2 py-1">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="rounded-lg bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 border border-slate-800 hover:border-sky-500/50 hover:text-sky-300 font-mono transition truncate max-w-[280px]"
                  title={term}
                >
                  {term.length > 24 ? `${term.slice(0, 10)}...${term.slice(-8)}` : term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1. Tokens Results */}
        {(selectedCategory === 'all' || selectedCategory === 'tokens') && liveTokens.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-400 font-mono">
              <span>Solana Tokens ({liveTokens.length})</span>
              <span className="text-slate-600">Click to trade • Quick Buy available</span>
            </div>
            <div className="space-y-1.5">
              {liveTokens.map((t) => {
                const isPump = t.source === 'Pump.fun' || t.mint?.toLowerCase().endsWith('pump');
                const priceChange = t.priceChange24h ?? 0;
                const isPositive = priceChange >= 0;

                return (
                  <div
                    key={t.mint}
                    onClick={() => handleSelectTokenTrade(t)}
                    className="w-full group relative flex items-center justify-between rounded-xl p-2.5 bg-slate-950/70 hover:bg-slate-900 border border-slate-800/80 hover:border-sky-500/50 transition-all cursor-pointer gap-2"
                  >
                    {/* Left: Avatar + Title & Meta */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <TokenAvatar
                        src={t.logoURI || t.logoUrl}
                        symbol={t.symbol}
                        name={t.name}
                        mint={t.mint}
                        size="md"
                        dexBadge={t.source}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-100 text-xs sm:text-sm group-hover:text-sky-300 truncate max-w-[140px]">
                            {t.name}
                          </span>
                          <span className="text-2xs font-mono text-slate-400">${t.symbol}</span>
                          {isPump && (
                            <span className="text-2xs px-1.5 py-0.2 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 font-bold">
                              💊 Pump.fun
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-2xs text-slate-500 font-mono mt-0.5">
                          <span className="truncate max-w-[160px]">{t.mint}</span>
                          <button
                            onClick={(e) => handleCopyCA(t.mint, e)}
                            className="hover:text-slate-300 transition"
                            title="Copy Contract Address"
                          >
                            {copiedMint === t.mint ? (
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                          </button>
                          {t.twitterUrl && (
                            <a
                              href={t.twitterUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-sky-400 transition"
                              title="Project Twitter/X"
                            >
                              X
                            </a>
                          )}
                          {t.websiteUrl && (
                            <a
                              href={t.websiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-emerald-400 transition"
                              title="Website"
                            >
                              <Globe className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle / Right: Price, MC & Actions */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right flex flex-col items-end">
                        <span className="font-bold text-slate-100 text-xs font-mono">
                          {formatTokenPrice(t.priceUsd)}
                        </span>
                        <div className="flex items-center gap-1.5 text-2xs">
                          <span className="text-slate-500">MC: ${formatCompactUsd(t.marketCapUsd)}</span>
                          <span
                            className={`font-bold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {priceChange.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleSelectTokenQuickBuy(t, e)}
                          className="h-6 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 text-2xs font-bold flex items-center gap-1 transition"
                          title="Instant Quick Buy"
                        >
                          <Zap className="h-2.5 w-2.5 fill-current" />
                          <span>BUY</span>
                        </button>
                        <button
                          onClick={() => handleSelectTokenTrade(t)}
                          className="h-6 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-2xs font-bold flex items-center gap-0.5 transition"
                          title="Open in Trade Terminal"
                        >
                          <span>Trade</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Commands & Navigation */}
        {(selectedCategory === 'all' || selectedCategory === 'commands') && filteredCommands.length > 0 && (
          <div>
            <p className="px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-400 font-mono">
              Commands & Navigation
            </p>
            <div className="space-y-1">
              {filteredCommands.map((item) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent hover:border-slate-700 transition text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-sky-500/40 text-slate-400 group-hover:text-sky-400 transition">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 text-xs sm:text-sm group-hover:text-sky-300">
                        {item.label}
                      </p>
                      <p className="text-2xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                  <kbd className="rounded-md bg-slate-900 px-2 py-0.5 text-2xs text-slate-400 font-mono border border-slate-800">
                    {item.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Direct Solana Address Lookup (if query is a valid Solana pubkey) */}
        {isSolanaAddress && (
          <div>
            <p className="px-2 py-1 text-2xs uppercase font-bold tracking-wider text-slate-400 font-mono">
              On-Chain Solana Lookup
            </p>
            <div className="space-y-1">
              <a
                href={`https://solscan.io/account/${query.trim()}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs text-slate-300 hover:bg-slate-800/80 hover:text-white border border-slate-800 hover:border-sky-500/50 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-4 w-4 text-sky-400" />
                  <div>
                    <p className="font-bold text-slate-100">Inspect Account on Solscan</p>
                    <p className="text-2xs text-slate-500 font-mono">{query.trim()}</p>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </a>
            </div>
          </div>
        )}

        {/* 4. Empty State */}
        {!hasAnyResults && !isLoadingTokens && query && (
          <EmptyState
            title="No Sentinel Results Found"
            description={`No tokens, wallets, creators, or commands matched "${query}".`}
          />
        )}
      </div>

      <div className="border-t border-slate-800 bg-[#070a0f] px-4 py-2.5 text-2xs text-slate-500 flex items-center justify-between font-mono">
        <span className="flex items-center gap-2">
          <span>Use ↑↓ arrows to navigate</span>
          <span>•</span>
          <span>Enter to select</span>
        </span>
        <span className="text-slate-400 font-bold">Sentinel Global Search v2</span>
      </div>
    </Modal>
  );
}

export default CommandPalette;
