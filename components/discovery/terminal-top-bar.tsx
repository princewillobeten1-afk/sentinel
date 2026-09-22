'use client';

import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Settings,
  ChevronDown,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Flame,
  TrendingUp,
  GraduationCap,
  Star,
  BarChart2,
  Pause,
  Play,
} from 'lucide-react';
import type { TimeWindow, DiscoverySection, DiscoveryColumnConfig } from '@/lib/discovery/types';
import type { DiscoveryHealth } from '@/lib/discovery/discovery-store';

interface TerminalTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedChain: string;
  onChainChange: (chain: string) => void;
  timeWindow: TimeWindow;
  onTimeWindowChange: (w: TimeWindow) => void;
  activeFilterCount: number;
  onOpenFilterDrawer: () => void;
  columns: DiscoveryColumnConfig[];
  onAddColumn: (type: DiscoverySection, title: string) => void;
  onResetLayout: () => void;
  quickBuyPresets: number[];
  /** Whether zero-liquidity launches are shown. Off by default. */
  showZeroLiquidity?: boolean;
  onToggleZeroLiquidity?: (next: boolean) => void;
  quickBuyMode: 'sol' | 'usd';
  onUpdateQuickBuySettings: (presets: number[], mode: 'sol' | 'usd') => void;
  health: DiscoveryHealth;
  paused: boolean;
  pendingRefresh: boolean;
  onTogglePause: () => void;
  freshnessAt: number;
}

const AVAILABLE_NEW_COLUMNS: { type: DiscoverySection; title: string; desc: string }[] = [
  { type: 'new', title: 'New Pairs', desc: 'Tokens freshly deployed on bonding curves & DEXs' },
  { type: 'migrating', title: 'Final Stretch', desc: 'Tokens near migration (~100% bonding curve completion)' },
  { type: 'graduated', title: 'Migrated', desc: 'Moved to the AMM/DEX (graduated trading pairs)' },
  { type: 'trending', title: 'Trending', desc: 'Ranked by recent market attention and activity' },
  { type: 'top-gainers', title: 'Gainers', desc: 'Largest measured positive price moves' },
  { type: 'volume', title: 'Volume', desc: 'Highest measured traded volume' },
  { type: 'liquidity', title: 'Liquidity', desc: 'Deepest measured liquidity pools' },
  { type: 'revived', title: 'Revived', desc: 'Older tokens showing renewed positive activity' },
  { type: 'legacy', title: 'Legacy', desc: 'Established tokens ranked by measured market cap' },
  { type: 'similar', title: 'Similar', desc: 'Tokens comparable to a selected reference mint' },
  { type: 'smart-money', title: 'Smart Money Inflow', desc: 'Tokens accumulated by tracked profitable wallets' },
  { type: 'ai-picks', title: 'AI Alpha Signals', desc: 'Algorithmic signals scored by Sentinel AI' },
  { type: 'watchlist', title: 'My Watchlist', desc: 'Your starred and tracked tokens' },
];

export function TerminalTopBar({
  searchQuery,
  onSearchChange,
  selectedChain,
  onChainChange,
  timeWindow,
  onTimeWindowChange,
  activeFilterCount,
  onOpenFilterDrawer,
  columns,
  onAddColumn,
  onResetLayout,
  quickBuyPresets,
  quickBuyMode,
  onUpdateQuickBuySettings,
  health,
  paused,
  pendingRefresh,
  onTogglePause,
  freshnessAt,
  showZeroLiquidity = false,
  onToggleZeroLiquidity,
}: TerminalTopBarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showQuickBuyModal, setShowQuickBuyModal] = useState(false);
  const [showChainMenu, setShowChainMenu] = useState(false);

  const [editPreset1, setEditPreset1] = useState(quickBuyPresets[0] || 0.05);
  const [editPreset2, setEditPreset2] = useState(quickBuyPresets[1] || 0.1);
  const [editPreset3, setEditPreset3] = useState(quickBuyPresets[2] || 0.5);
  const [editPreset4, setEditPreset4] = useState(quickBuyPresets[3] || 1.0);
  const [editMode, setEditMode] = useState<'sol' | 'usd'>(quickBuyMode);

  const handleSaveQuickBuy = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateQuickBuySettings([editPreset1, editPreset2, editPreset3, editPreset4], editMode);
    setShowQuickBuyModal(false);
  };

  return (
    <div className="discovery-toolbar relative shrink-0 z-20 bg-sentinel-950 border-b border-slate-700 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Left Section: Search & Chain & Time Window */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 basis-full xl:basis-auto">
        {/* Global Search Input */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            aria-label="Filter discovery tokens"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search token, symbol, CA..."
            className="w-full h-7 pl-8 pr-2.5 rounded-lg bg-slate-900/90 border border-slate-800 focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/50 text-slate-100 placeholder-slate-500 text-xs font-mono transition-all"
          />
        </div>

        {/* Chain Selector */}
        <div className="relative">
          <button
            onClick={() => setShowChainMenu(!showChainMenu)}
            aria-expanded={showChainMenu}
            className="h-7 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Solana</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {showChainMenu && (
            <div className="absolute left-0 mt-1 w-44 bg-[#0d121a] border border-slate-700/80 rounded-lg shadow-xl py-1 z-30 text-[11px]">
              <button
                onClick={() => { onChainChange('solana'); setShowChainMenu(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/10 flex items-center justify-between text-sky-400 font-bold"
              >
                <span>Solana (Active)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </button>
              <div className="px-3 py-1 text-2xs text-slate-500 border-t border-slate-800 mt-1">
                Coming Soon:
              </div>
              <div className="px-3 py-1 text-slate-500 cursor-not-allowed">Ethereum</div>
              <div className="px-3 py-1 text-slate-500 cursor-not-allowed">Base</div>
              <div className="px-3 py-1 text-slate-500 cursor-not-allowed">BNB Chain</div>
            </div>
          )}
        </div>

        {/* Time Window Buttons */}
        <div aria-label="Time window" className="flex items-center bg-slate-950 p-1 rounded-md border border-slate-700 text-2xs">
          {(['5m', '1h', '24h'] as TimeWindow[]).map((w) => (
            <button
              key={w}
              aria-pressed={timeWindow === w}
              onClick={() => onTimeWindowChange(w)}
              className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                timeWindow === w
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Right Section: Quick Buy Presets, Column Manager, Advanced Filters & Stream Status */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Quick Buy Presets Pill Configuration */}
        <button
          onClick={() => setShowQuickBuyModal(true)}
          className="h-7 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 flex items-center gap-1.5 text-xs transition-colors"
          title="Configure Quick Buy Amounts"
        >
          <Zap className="w-3 h-3 text-emerald-400 fill-current" />
          <span className="text-2xs text-slate-400">Quick Buy:</span>
          <span className="font-bold text-slate-200">
            {quickBuyMode === 'sol' ? `≡${quickBuyPresets[0]}` : `$${quickBuyPresets[0]}`}
          </span>
          <Settings className="w-2.5 h-2.5 text-slate-500" />
        </button>

        {/* Dead-row toggle.
            Twelve of thirty rows in a measured response had no pool at all —
            they cannot be traded, so they are hidden by default rather than
            occupying the feed. The toggle is visible so the filtering is a
            stated choice, not a silent one. */}
        <button
          onClick={() => onToggleZeroLiquidity?.(!showZeroLiquidity)}
          aria-pressed={showZeroLiquidity}
          className={`h-7 px-2.5 rounded-lg border font-bold text-2xs flex items-center gap-1 transition-colors ${
            showZeroLiquidity
              ? 'bg-amber-950/50 border-amber-900/60 text-amber-300'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
          }`}
          title={
            showZeroLiquidity
              ? 'Showing launches with no liquidity pool. These cannot be traded.'
              : 'Launches with no liquidity pool are hidden. They cannot be traded.'
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${showZeroLiquidity ? 'bg-amber-400' : 'bg-slate-600'}`} />
          <span>No-liquidity</span>
        </button>

        {/* Column Manager: Add Column Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            aria-expanded={showAddMenu}
            className="h-7 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs flex items-center gap-1 transition-colors"
            title="Add another column feed"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            <span>Add Column</span>
            <span className="text-2xs text-slate-500 font-normal">({columns.length})</span>
          </button>

          {showAddMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-[#0d121a] border border-slate-700/80 rounded-lg shadow-xl py-1 z-30 text-xs">
              <div className="px-3 py-1.5 text-2xs font-bold uppercase text-slate-400 border-b border-slate-800">
                Add Feed Column
              </div>
              {AVAILABLE_NEW_COLUMNS.map((col) => (
                <button
                  key={col.type}
                  onClick={() => {
                    onAddColumn(col.type, col.title);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-sky-500/10 flex flex-col gap-0.5 transition-colors border-b border-slate-800/40 last:border-0"
                >
                  <span className="font-bold text-slate-200">{col.title}</span>
                  <span className="text-2xs text-slate-500 leading-tight">{col.desc}</span>
                </button>
              ))}
              <div className="p-1.5 bg-slate-950/60 border-t border-slate-800 text-center">
                <button
                  onClick={() => {
                    onResetLayout();
                    setShowAddMenu(false);
                  }}
                  className="text-2xs text-slate-400 hover:text-sky-400 font-bold flex items-center justify-center gap-1 mx-auto"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Reset Default Columns</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Filters Trigger Button */}
        <button
          onClick={onOpenFilterDrawer}
          className={`h-7 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all ${
            activeFilterCount > 0
              ? 'bg-sky-500/10 border-sky-500/60 text-sky-300'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3 text-sky-400" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-slate-950 text-2xs font-black">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Shared stream health and inspection pause */}
        <button
          onClick={onTogglePause}
          aria-pressed={paused}
          className={`h-7 px-2 rounded-lg border flex items-center gap-1.5 text-2xs font-bold transition-colors ${
            paused ? 'bg-amber-950/50 border-amber-800/60 text-amber-300' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
          }`}
          title={paused ? 'Resume live updates' : 'Freeze the board for inspection'}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          <span>{paused ? 'Resume' : 'Freeze'}</span>
          {paused && pendingRefresh && <span className="text-amber-400">•</span>}
        </button>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-bold border ${
            health === 'live'
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
              : health === 'degraded'
                ? 'bg-amber-950/40 border-amber-800/50 text-amber-400'
                : health === 'stale'
                  ? 'bg-orange-950/40 border-orange-800/50 text-orange-300'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
          }`}
          title={`Discovery feed: ${health}${freshnessAt ? `; last update ${new Date(freshnessAt).toLocaleTimeString()}` : ''}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${health === 'live' ? 'bg-emerald-400 animate-pulse' : health === 'degraded' ? 'bg-amber-400' : 'bg-rose-400'}`} />
          <span>{health.toUpperCase()}</span>
        </div>
      </div>

      {/* Quick Buy Presets Configuration Modal */}
      {showQuickBuyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e131b] border border-slate-700/90 rounded-xl max-w-sm w-full p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400 fill-current" />
                Quick Buy Settings
              </h3>
              <button
                onClick={() => setShowQuickBuyModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickBuy} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 text-2xs uppercase font-bold">Currency Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMode('sol')}
                    className={`py-1.5 rounded-lg font-bold border text-xs ${
                      editMode === 'sol'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    SOL (≡)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode('usd')}
                    disabled
                    title="The connected-wallet execution flow is SOL-funded"
                    className={`py-1.5 rounded-lg font-bold border text-xs ${
                      editMode === 'usd'
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    USD (not available)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 text-2xs uppercase font-bold">Preset Amounts ({editMode.toUpperCase()})</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-2xs text-slate-500 block mb-0.5">Preset 1</span>
                    <input
                      type="number"
                      step="any"
                      value={editPreset1}
                      onChange={(e) => setEditPreset1(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-2xs text-slate-500 block mb-0.5">Preset 2</span>
                    <input
                      type="number"
                      step="any"
                      value={editPreset2}
                      onChange={(e) => setEditPreset2(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-2xs text-slate-500 block mb-0.5">Preset 3</span>
                    <input
                      type="number"
                      step="any"
                      value={editPreset3}
                      onChange={(e) => setEditPreset3(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-2xs text-slate-500 block mb-0.5">Preset 4</span>
                    <input
                      type="number"
                      step="any"
                      value={editPreset4}
                      onChange={(e) => setEditPreset4(parseFloat(e.target.value) || 0)}
                      className="w-full h-8 px-2 rounded bg-slate-900 border border-slate-800 text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickBuyModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs shadow-md"
                >
                  Save Presets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
