'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppState, useAppActions, AppView } from '@/lib/store';
import { searchTokens } from '@/lib/token/search-service';
import useRouter from 'next/navigation';

export type SearchCategory = 'all' | 'tokens' | 'wallets' | 'creators' | 'launches' | 'commands';

export function CommandPalette() {
  const { isCommandPaletteOpen } = useAppState();
  const { setCommandPaletteOpen, setActiveView, setQuickBuyOpen, setHotkeysOpen, setWalletModalOpen } = useAppActions();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('all');

  const [recentSearches, setRecentSearches] = useState<string[]>([
    '$SENT',
    '7xK9...3a19',
    'Raydium Router',
    'Creator 9pQ1',
  ]);

  const navCommands: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }>; view: AppView; shortcut: string }> = [
    { id: 'dash', label: 'Go to Overview Dashboard', icon: LayoutDashboard, view: 'dashboard', shortcut: 'G H' },
    { id: 'trd', label: 'Go to DEX Trade Terminal', icon: Wallet, view: 'trade', shortcut: 'G T' },
    { id: 'disc', label: 'Go to Token Discovery Screener', icon: Compass, view: 'discover', shortcut: 'G D' },
    { id: 'port', label: 'Go to Portfolio & Net P&L', icon: PieChart, view: 'portfolio', shortcut: 'G P' },
    { id: 'wtch', label: 'Go to Watchlist', icon: Bookmark, view: 'watchlist', shortcut: 'G W' },
    { id: 'alrt', label: 'Go to Risk Alerts & Intelligence', icon: ShieldAlert, view: 'alerts', shortcut: 'G A' },
    { id: 'lnch', label: 'Go to Token Launchpad', icon: Rocket, view: 'launchpad', shortcut: 'G L' },
    { id: 'intel', label: 'Go to Blockchain Intelligence', icon: BrainCircuit, view: 'intelligence', shortcut: 'G I' },
    { id: 'ai', label: 'Go to Sentinel AI Co-Pilot', icon: Sparkles, view: 'ai', shortcut: 'G AI' },
    { id: 'anlt', label: 'Go to Market Analytics', icon: BarChart3, view: 'analytics', shortcut: 'G AN' },
    { id: 'admin', label: 'Go to Admin Operations & Emergency Control', icon: ShieldCheck, view: 'admin', shortcut: 'G ADM' },
    { id: 'sets', label: 'Go to Terminal Preferences', icon: Settings, view: 'settings', shortcut: 'G S' },
    { id: 'help', label: 'Go to Help & Documentation', icon: HelpCircle, view: 'help', shortcut: 'G ?' },
  ];

  const mockTokens = [
    { name: 'Solana Sentinel', symbol: '$SENT', mint: '7xK99zK8mP2xQ5wN3a19', price: '$0.0425', mcap: '$14.2M', risk: 'low' },
    { name: 'Cyber Core AI', symbol: '$CYBER', mint: '3mA1...4c90', price: '$0.1850', mcap: '$6.8M', risk: 'med' },
    { name: 'Solana Meme', symbol: '$SOLM', mint: '9pW2...8b11', price: '$0.0084', mcap: '$840K', risk: 'critical' },
  ];

  const mockWallets = [
    { label: 'Smart Money Cluster #1', address: '4zW8...9kL2', balance: '1,420 SOL', reputation: 'Smart Money' },
    { label: 'Insider Deployer 7xK9', address: '7xK9...2mP1', balance: '42.8 SOL', reputation: 'Insider' },
  ];

  const mockCreators = [
    { name: 'Alpha Dev Team', address: '9pQ1...4c00', trackRecord: '12 Tokens (0 Rugged)', reputation: 'Verified' },
    { name: 'Degen Creator X', address: '1aM3...2b88', trackRecord: '5 Tokens (3 Rugged)', reputation: 'High Risk' },
  ];

  const mockLaunches = [
    { name: 'Sentinel Protocol Launch', symbol: '$SENT', target: '100 SOL', status: 'Active' },
    { name: 'Cyber Guard AI Launch', symbol: '$CGAI', target: '100 SOL', status: 'Migrated' },
  ];

  const matchQuery = (str: string) => str.toLowerCase().includes(query.toLowerCase());

  const filteredCommands = navCommands.filter((c) => matchQuery(c.label));
  const filteredTokens = searchTokens(query);
  const filteredWallets = mockWallets.filter((w) => matchQuery(w.label) || matchQuery(w.address));
  const filteredCreators = mockCreators.filter((c) => matchQuery(c.name) || matchQuery(c.address));
  const filteredLaunches = mockLaunches.filter((l) => matchQuery(l.name) || matchQuery(l.symbol));

  const hasAnyResults =
    (selectedCategory === 'all' || selectedCategory === 'commands') && filteredCommands.length > 0 ||
    (selectedCategory === 'all' || selectedCategory === 'tokens') && filteredTokens.length > 0 ||
    (selectedCategory === 'all' || selectedCategory === 'wallets') && filteredWallets.length > 0 ||
    (selectedCategory === 'all' || selectedCategory === 'creators') && filteredCreators.length > 0 ||
    (selectedCategory === 'all' || selectedCategory === 'launches') && filteredLaunches.length > 0;

  const handleSelectNav = (view: AppView) => {
    setActiveView(view);
    setCommandPaletteOpen(false);
    setQuery('');
  };

  const handleSelectSearchTerm = (term: string) => {
    setQuery(term);
  };

  const clearRecent = () => setRecentSearches([]);

  return (
    <Modal
      isOpen={isCommandPaletteOpen}
      onClose={() => {
        setCommandPaletteOpen(false);
        setQuery('');
      }}
      size="lg"
      className="p-0 border-sentinel-600 bg-sentinel-950 select-none"
    >
      {/* Search Input Bar */}
      <div className="flex items-center gap-3 border-b border-sentinel-700/80 px-4 py-3 bg-sentinel-900/90">
        <Search className="h-5 w-5 text-sky-400 shrink-0" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens, wallets, creators, launches, or type a command..."
          className="w-full bg-transparent text-base text-slate-100 placeholder-slate-500 outline-none font-medium"
        />
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-sentinel-800 px-2 py-0.5 text-xs text-slate-400 font-mono border border-sentinel-700">
          ESC
        </kbd>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-sentinel-800 bg-sentinel-950 font-mono text-xs overflow-x-auto no-scrollbar">
        {(['all', 'tokens', 'wallets', 'creators', 'launches', 'commands'] as SearchCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded transition uppercase ${
              selectedCategory === cat
                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4 font-numeric">
        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <History className="h-3 w-3" /> Recent Searches
              </span>
              <button onClick={clearRecent} className="text-slate-400 hover:text-rose-400 transition">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 py-1">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSelectSearchTerm(term)}
                  className="rounded-md bg-sentinel-900 px-2.5 py-1 text-xs text-slate-300 border border-sentinel-800 hover:border-sentinel-600 hover:text-sky-300 font-mono transition"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Commands */}
        {(selectedCategory === 'all' || selectedCategory === 'commands') && filteredCommands.length > 0 && (
          <div>
            <p className="px-3 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              Commands & Navigation
            </p>
            <div className="space-y-1">
              {filteredCommands.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectNav(item.view)}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-sentinel-800 hover:text-white transition text-left"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-slate-400" />
                    <span>{item.label}</span>
                  </div>
                  <kbd className="rounded bg-sentinel-950 px-2 py-0.5 text-xs text-slate-400 font-mono border border-sentinel-800">
                    {item.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tokens Results */}
        {(selectedCategory === 'all' || selectedCategory === 'tokens') && filteredTokens.length > 0 && (
          <div>
            <p className="px-3 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              Tokens
            </p>
            <div className="space-y-1">
              {filteredTokens.map((t) => (
                <div
                  key={t.symbol}
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setQuickBuyOpen(true, {
                      name: t.name,
                      symbol: t.symbol,
                      mint: t.mint,
                      price: `$${t.priceUsd}`,
                      mcap: t.marketCapUsd,
                    });
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-sentinel-800 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sentinel-750 font-bold text-xs text-sky-300">
                      {t.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100 text-xs flex items-center gap-2">
                        {t.name} <span className="text-slate-400 font-mono">${t.symbol}</span>
                      </p>
                      <p className="text-2xs text-slate-500 font-numeric">{t.mint}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-numeric text-slate-400">MCap {t.marketCapUsd}</span>
                    <Badge variant={t.riskRating === 'low' ? 'risk-low' : 'risk-critical'} size="sm">
                      {t.riskRating}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallets Results */}
        {(selectedCategory === 'all' || selectedCategory === 'wallets') && filteredWallets.length > 0 && (
          <div>
            <p className="px-3 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              Wallets & Insiders
            </p>
            <div className="space-y-1">
              {filteredWallets.map((w) => (
                <div
                  key={w.address}
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setActiveView('intelligence');
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-sentinel-800 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Wallet className="h-4 w-4 text-sky-400" />
                    <div>
                      <p className="font-bold text-slate-100">{w.label}</p>
                      <p className="text-2xs text-slate-500 font-mono">{w.address}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">{w.balance}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creators Results */}
        {(selectedCategory === 'all' || selectedCategory === 'creators') && filteredCreators.length > 0 && (
          <div>
            <p className="px-3 py-1 text-2xs uppercase font-bold tracking-wider text-slate-500 font-mono">
              Creators & Deployers
            </p>
            <div className="space-y-1">
              {filteredCreators.map((c) => (
                <div
                  key={c.address}
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setActiveView('intelligence');
                  }}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-sentinel-800 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-purple-400" />
                    <div>
                      <p className="font-bold text-slate-100">{c.name}</p>
                      <p className="text-2xs text-slate-500 font-mono">{c.trackRecord}</p>
                    </div>
                  </div>
                  <Badge variant={c.reputation === 'Verified' ? 'risk-low' : 'risk-critical'} size="sm">
                    {c.reputation}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hasAnyResults && query && (
          <EmptyState
            title="No Sentinel Results Found"
            description={`No tokens, wallets, creators, or commands matched "${query}".`}
          />
        )}
      </div>

      <div className="border-t border-sentinel-800 bg-sentinel-950 px-4 py-2 text-2xs text-slate-500 flex items-center justify-between font-mono">
        <span>Use ↑↓ arrows to navigate, Enter to select</span>
        <span>Sentinel Command Bar v1.0</span>
      </div>
    </Modal>
  );
}
