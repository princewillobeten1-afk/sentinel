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
import { Modal } from '@/components/ui/modal';

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
  quickBuyEnabled?: boolean;
  onToggleQuickBuy?: () => void;
  onCycleQuickBuyPreset?: () => void;
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
  { type: 'migrating', title: 'Final Stretch', desc: 'Tokens nearing graduation across Pump.fun, Moonshot, LaunchLab, Meteora DBC, and more' },
  { type: 'graduated', title: 'Migrated', desc: 'Graduated tokens with confirmed liquidity pools on Raydium CPMM, AMM, Meteora, and PumpSwap' },
  { type: 'trending', title: 'Trending', desc: 'Ranked by recent market attention and activity' },
  { type: 'top-gainers', title: 'Gainers', desc: 'Largest measured positive price moves' },
  { type: 'volume', title: 'Volume', desc: 'Highest measured traded volume' },
  { type: 'liquidity', title: 'Liquidity', desc: 'Deepest measured liquidity pools' },
  { type: 'revived', title: 'Revived', desc: 'Older tokens showing renewed positive activity' },
  { type: 'legacy', title: 'Legacy', desc: 'Established tokens ranked by measured market cap' },
  { type: 'similar', title: 'Similar', desc: 'Tokens comparable to a selected reference mint' },
  { type: 'smart-money', title: 'Smart Money Inflow', desc: 'Tokens accumulated by tracked profitable wallets' },
  { type: 'ai-picks', title: 'AI Alpha Signals', desc: 'Algorithmic signals scored by Phivex AI' },
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
  quickBuyEnabled = true,
  onToggleQuickBuy,
  onCycleQuickBuyPreset,
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

  // Synchronize modal state whenever presets change or modal opens
  React.useEffect(() => {
    setEditPreset1(quickBuyPresets[0] || 0.05);
    setEditPreset2(quickBuyPresets[1] || 0.1);
    setEditPreset3(quickBuyPresets[2] || 0.5);
    setEditPreset4(quickBuyPresets[3] || 1.0);
    setEditMode(quickBuyMode);
  }, [quickBuyPresets, quickBuyMode, showQuickBuyModal]);

  const handleSaveQuickBuy = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateQuickBuySettings([editPreset1, editPreset2, editPreset3, editPreset4], editMode);
    setShowQuickBuyModal(false);
  };

  return (
    <div className="discovery-toolbar relative shrink-0 z-20 bg-[#0A0D12] border-b border-[#1E222D] py-2 px-1 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Left Section: Search & Chain & Time Window */}
      <div className="discovery-toolbar-search flex flex-wrap items-center gap-2 flex-1 min-w-0 basis-full xl:basis-auto">
        {/* Global Search Input */}
        <div className="relative flex-1 min-w-[170px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#828598]" />
          <input
            type="text"
            aria-label="Filter discovery tokens"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search token, ticker, or CA..."
            className="w-full h-7 pl-8 pr-2.5 rounded-[6px] bg-[#11141B] border border-[#1E222D] focus:border-[#526FFF]/70 focus:ring-1 focus:ring-[#526FFF]/40 text-[#F7F8F9] placeholder-[#525866] text-xs font-mono transition-all outline-none"
          />
        </div>

        {/* Chain Selector */}
        <div className="relative">
          <button
            onClick={() => setShowChainMenu(!showChainMenu)}
            aria-expanded={showChainMenu}
            className="h-7 px-2.5 rounded-[6px] bg-[#11141B] hover:bg-[#1C202B] border border-[#1E222D] hover:border-[#32374A] text-[#F7F8F9] font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${selectedChain === 'robinhood' ? 'bg-[#2FE3AC]' : 'bg-[#526FFF]'}`} />
            <span>{selectedChain === 'robinhood' ? 'Robinhood' : 'Solana'}</span>
            <ChevronDown className="w-3 h-3 text-[#828598]" />
          </button>

          {showChainMenu && (
            <div className="absolute left-0 mt-1 w-48 bg-[#11141B] border border-[#222634] rounded-[8px] shadow-xl py-1 z-30 text-[11px]">
              <button
                onClick={() => { onChainChange('solana'); setShowChainMenu(false); }}
                className={`w-full text-left px-3 py-1.5 hover:bg-[#526FFF]/10 flex items-center justify-between font-semibold ${
                  selectedChain === 'solana' ? 'text-[#8EA2FF]' : 'text-[#C8C9D1]'
                }`}
              >
                <span>Solana</span>
                {selectedChain === 'solana' && <span className="w-1.5 h-1.5 rounded-full bg-[#2FE3AC]" />}
              </button>
              <button
                onClick={() => { onChainChange('robinhood'); setShowChainMenu(false); }}
                className={`w-full text-left px-3 py-1.5 hover:bg-[#2FE3AC]/10 flex items-center justify-between font-semibold ${
                  selectedChain === 'robinhood' ? 'text-[#2FE3AC]' : 'text-[#C8C9D1]'
                }`}
              >
                <span>Robinhood Chain (4663)</span>
                {selectedChain === 'robinhood' && <span className="w-1.5 h-1.5 rounded-full bg-[#2FE3AC]" />}
              </button>
              <div className="px-3 py-1 text-[10px] text-[#525866] border-t border-[#1E222D] mt-1">
                Coming Soon:
              </div>
              <div className="px-3 py-1 text-[#525866] cursor-not-allowed">Ethereum</div>
              <div className="px-3 py-1 text-[#525866] cursor-not-allowed">Base</div>
              <div className="px-3 py-1 text-[#525866] cursor-not-allowed">BNB Chain</div>
            </div>
          )}
        </div>

        {/* Time Window Buttons */}
        <div aria-label="Time window" className="flex items-center bg-[#0D1015] p-0.5 rounded-[6px] border border-[#1E222D] text-[11px]">
          {(['5m', '1h', '24h'] as TimeWindow[]).map((w) => (
            <button
              key={w}
              aria-pressed={timeWindow === w}
              onClick={() => onTimeWindowChange(w)}
              className={`px-2.5 py-0.5 rounded-[4px] font-semibold transition-all ${
                timeWindow === w
                  ? 'bg-[#526FFF]/20 text-[#8EA2FF] border border-[#526FFF]/35'
                  : 'text-[#828598] hover:text-[#F7F8F9] border border-transparent'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Right Section: Quick Buy Presets, Column Manager, Advanced Filters & Stream Status */}
      <div className="discovery-toolbar-controls flex flex-wrap items-center gap-2 min-w-0" aria-label="Discovery controls">
        {/* Advanced Filters Trigger Button */}
        <button
          onClick={onOpenFilterDrawer}
          className={`h-7 px-2.5 rounded-[6px] border flex items-center gap-1.5 text-xs font-semibold transition-all ${
            activeFilterCount > 0
              ? 'bg-[#526FFF]/15 border-[#526FFF]/40 text-[#8EA2FF]'
              : 'bg-[#11141B] hover:bg-[#1C202B] border-[#1E222D] text-[#C8C9D1]'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3 text-[#526FFF]" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-px rounded-full bg-[#526FFF] text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Shared stream health and inspection pause */}
        <button
          onClick={onTogglePause}
          aria-pressed={paused}
          className={`h-7 px-2.5 rounded-[6px] border flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
            paused ? 'bg-[#FFB224]/15 border-[#FFB224]/40 text-[#FFB224]' : 'bg-[#11141B] hover:bg-[#1C202B] border-[#1E222D] text-[#C8C9D1]'
          }`}
          title={paused ? 'Resume live updates' : 'Freeze the board for inspection'}
        >
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          <span>{paused ? 'Resume' : 'Freeze'}</span>
          {paused && pendingRefresh && <span className="text-[#FFB224]">•</span>}
        </button>

        {/* Interactive Quick Buy Toggle & Presets (Axiom Unified Pill Bar) */}
        <div className="flex items-center rounded-full border border-[#222634] bg-[#11141B] overflow-hidden text-xs">
          {/* Main Toggle Button */}
          <button
            type="button"
            onClick={onToggleQuickBuy}
            aria-pressed={quickBuyEnabled}
            className={`h-7 px-2.5 flex items-center gap-1.5 font-semibold transition-all ${
              quickBuyEnabled
                ? 'bg-[#526FFF]/15 border-r border-[#526FFF]/30 text-[#8EA2FF]'
                : 'bg-[#11141B] text-[#828598] hover:text-[#F7F8F9] border-r border-[#1E222D]'
            }`}
            title={quickBuyEnabled ? 'Quick Buy is ACTIVE (click to toggle off)' : 'Quick Buy is OFF (click to toggle on)'}
          >
            <Zap className={`w-3 h-3 ${quickBuyEnabled ? 'text-[#526FFF] fill-current' : 'text-[#525866]'}`} />
            <span className="text-[11px] font-semibold">Quick Buy</span>
            <span className={`w-1.5 h-1.5 rounded-full ${quickBuyEnabled ? 'bg-[#2FE3AC]' : 'bg-[#525866]'}`} />
          </button>

          {/* Quick Preset Amount Selector: Click to cycle presets */}
          <button
            type="button"
            onClick={onCycleQuickBuyPreset}
            className="h-7 px-2.5 hover:bg-[#1C202B] text-[#F7F8F9] font-mono font-semibold transition-colors border-r border-[#1E222D] flex items-center gap-1"
            title={`Click to cycle quick buy amount (0.05, 0.1, 0.5, 1.0 ${selectedChain === 'robinhood' ? 'ETH' : 'SOL'})`}
          >
            <span>
              {quickBuyMode === 'sol'
                ? `${selectedChain === 'robinhood' ? 'Ξ' : '≡'}${quickBuyPresets[0]}`
                : `$${quickBuyPresets[0]}`}
            </span>
          </button>

          {/* Settings Gear to open modal */}
          <button
            type="button"
            onClick={() => setShowQuickBuyModal(true)}
            className="h-7 px-2 text-[#828598] hover:text-[#F7F8F9] hover:bg-[#1C202B] transition-colors"
            title="Configure custom Quick Buy amounts"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>

        {/* Dead-row toggle */}
        <button
          onClick={() => onToggleZeroLiquidity?.(!showZeroLiquidity)}
          aria-pressed={showZeroLiquidity}
          className={`h-7 px-2.5 rounded-[6px] border font-semibold text-[11px] flex items-center gap-1.5 transition-colors ${
            showZeroLiquidity
              ? 'bg-[#FFB224]/15 border-[#FFB224]/35 text-[#FFB224]'
              : 'bg-[#11141B] hover:bg-[#1C202B] border-[#1E222D] text-[#828598] hover:text-[#C8C9D1]'
          }`}
          title={
            showZeroLiquidity
              ? 'Showing launches with no liquidity pool. These cannot be traded.'
              : 'Launches with no liquidity pool are hidden. They cannot be traded.'
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${showZeroLiquidity ? 'bg-[#FFB224]' : 'bg-[#525866]'}`} />
          <span>No-liquidity</span>
        </button>

        {/* Column Manager: Add Column Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            aria-expanded={showAddMenu}
            className="h-7 px-2.5 rounded-[6px] bg-[#11141B] hover:bg-[#1C202B] border border-[#1E222D] text-[#C8C9D1] font-semibold text-xs flex items-center gap-1 transition-colors"
            title="Add another column feed"
          >
            <Plus className="w-3 h-3 text-[#526FFF]" />
            <span>Add Column</span>
            <span className="text-[10px] text-[#828598] font-normal">({columns.length})</span>
          </button>

          {showAddMenu && (
            <div className="discovery-add-menu absolute right-0 mt-1 w-64 bg-[#11141B] border border-[#222634] rounded-[8px] shadow-xl py-1 z-30 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#828598] border-b border-[#1E222D]">
                Add Feed Column
              </div>
              {AVAILABLE_NEW_COLUMNS.map((col) => (
                <button
                  key={col.type}
                  onClick={() => {
                    onAddColumn(col.type, col.title);
                    setShowAddMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#526FFF]/10 flex flex-col gap-0.5 transition-colors border-b border-[#1E222D]/60 last:border-0"
                >
                  <span className="font-semibold text-[#F7F8F9]">{col.title}</span>
                  <span className="text-[11px] text-[#828598] leading-tight">{col.desc}</span>
                </button>
              ))}
              <div className="p-1.5 bg-[#090B10] border-t border-[#1E222D] text-center">
                <button
                  onClick={() => {
                    onResetLayout();
                    setShowAddMenu(false);
                  }}
                  className="text-[11px] text-[#828598] hover:text-[#8EA2FF] font-semibold flex items-center justify-center gap-1 mx-auto"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Reset Default Columns</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] text-[11px] font-semibold border ${
            health === 'live'
              ? 'bg-[#12AF80]/12 border-[#12AF80]/30 text-[#2FE3AC]'
              : health === 'degraded'
                ? 'bg-[#526FFF]/12 border-[#526FFF]/30 text-[#8EA2FF]'
                : health === 'stale'
                  ? 'bg-[#FFB224]/12 border-[#FFB224]/30 text-[#FFB224]'
                  : 'bg-[#EC397A]/12 border-[#EC397A]/30 text-[#FF6166]'
          }`}
          title={`Discovery feed: ${health === 'degraded' ? 'polling (REST active)' : health}${freshnessAt ? `; last update ${new Date(freshnessAt).toLocaleTimeString()}` : ''}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${health === 'live' ? 'bg-[#2FE3AC] animate-pulse' : health === 'degraded' ? 'bg-[#526FFF]' : 'bg-[#EC397A]'}`} />
          <span>{health === 'degraded' ? 'POLLING' : health.toUpperCase()}</span>
        </div>
      </div>

      {/* Quick Buy Presets Configuration Modal */}
      <Modal isOpen={showQuickBuyModal} onClose={() => setShowQuickBuyModal(false)} title="Quick Buy Settings" size="sm">
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
                    {selectedChain === 'robinhood' ? 'ETH (Ξ)' : 'SOL (≡)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode('usd')}
                    disabled
                    title={`The connected-wallet execution flow is ${selectedChain === 'robinhood' ? 'ETH' : 'SOL'}-funded`}
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
                      aria-label="Preset 1 amount"
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
                      aria-label="Preset 2 amount"
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
                      aria-label="Preset 3 amount"
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
                      aria-label="Preset 4 amount"
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
      </Modal>
    </div>
  );
}
