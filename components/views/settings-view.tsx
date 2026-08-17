'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Settings,
  Wallet,
  Sliders,
  ShieldCheck,
  Zap,
  Bell,
  Globe,
  DollarSign,
  Lock,
  User,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// Code-split (Sprint 31 — Item 8): the wallets tab is only one of several
// tabs on this view, so its JS shouldn't load until it's actually opened.
const WalletManagementView = dynamic(() => import('./wallet-management-view').then((m) => m.WalletManagementView), {
  loading: () => (
    <div className="flex items-center justify-center py-16 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});
import {
  useAppState,
  useAppActions,
  usePreferencesState,
  usePreferencesActions,
  DensityMode,
} from '@/lib/store';
import { UI_SCALE_MIN, UI_SCALE_MAX } from '@/lib/store/ui-store';

type SettingsTab = 'wallets' | 'trading' | 'risk' | 'display' | 'notifications';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('wallets');

  const { density, uiScale } = useAppState();
  const { setDensity, setUiScale, adjustUiScale, resetUiScale } = useAppActions();
  const { preferences, isSaving } = usePreferencesState();
  const { updatePreferences } = usePreferencesActions();

  const handleSlippageChange = (val: number) => {
    updatePreferences({ slippageTolerance: val });
  };

  const handleRiskChange = (level: 'conservative' | 'moderate' | 'high' | 'degenerate') => {
    updatePreferences({ riskLevel: level });
  };

  const handleCurrencyChange = (curr: 'USD' | 'SOL' | 'EUR' | 'BTC') => {
    updatePreferences({ currencyDisplay: curr });
  };

  const handleRpcChange = (rpc: 'mainnet' | 'devnet' | 'custom') => {
    updatePreferences({ rpcEndpoint: rpc });
  };

  const handleAutoLockChange = (mins: number) => {
    updatePreferences({ autoLockMinutes: mins });
  };

  const handleNotificationToggle = (key: keyof typeof preferences.notificationsEnabled) => {
    updatePreferences({
      notificationsEnabled: {
        ...preferences.notificationsEnabled,
        [key]: !preferences.notificationsEnabled[key],
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sentinel-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-sky-400" /> Account Preferences & Wallet Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure Web3 wallet identity, trading defaults, risk rules, and user preferences.
          </p>
        </div>

        {isSaving && (
          <Badge variant="info" className="animate-pulse">
            Saving Preferences...
          </Badge>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-sentinel-800 pb-2 overflow-x-auto no-scrollbar font-mono text-xs">
        <button
          onClick={() => setActiveTab('wallets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
            activeTab === 'wallets'
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
              : 'border-sentinel-800 bg-sentinel-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" /> Linked Wallets
        </button>

        <button
          onClick={() => setActiveTab('trading')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
            activeTab === 'trading'
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
              : 'border-sentinel-800 bg-sentinel-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="h-4 w-4" /> Trading Defaults
        </button>

        <button
          onClick={() => setActiveTab('risk')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
            activeTab === 'risk'
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
              : 'border-sentinel-800 bg-sentinel-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Risk & Security Controls
        </button>

        <button
          onClick={() => setActiveTab('display')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
            activeTab === 'display'
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
              : 'border-sentinel-800 bg-sentinel-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" /> Display & Theme
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition ${
            activeTab === 'notifications'
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 font-bold'
              : 'border-sentinel-800 bg-sentinel-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="h-4 w-4" /> Notifications
        </button>
      </div>

      {/* TAB 1: Linked Wallets Dashboard */}
      {activeTab === 'wallets' && <WalletManagementView />}

      {/* TAB 2: Trading Defaults */}
      {activeTab === 'trading' && (
        <div className="space-y-6">
          <Panel title="Default Slippage Tolerance" subtitle="Set max allowed slippage for swap executions">
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">Preset slippage percentage:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                {[0.1, 0.5, 1.0, 3.0].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleSlippageChange(val)}
                    className={`p-3 rounded-xl border text-center transition font-bold ${
                      preferences.slippageTolerance === val
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-glow'
                        : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-slate-200'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="RPC Node Configuration" subtitle="Select default RPC provider node for Solana transaction routing">
            <div className="space-y-3 text-xs font-mono">
              {[
                { id: 'mainnet', label: 'Solana Mainnet-Beta (Fast Primary)', url: 'https://api.mainnet-beta.solana.com' },
                { id: 'devnet', label: 'Solana Devnet (Test Network)', url: 'https://api.devnet.solana.com' },
              ].map((rpc) => (
                <div
                  key={rpc.id}
                  onClick={() => handleRpcChange(rpc.id as any)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition ${
                    preferences.rpcEndpoint === rpc.id
                      ? 'border-sky-500 bg-sky-950/20 text-slate-100'
                      : 'border-sentinel-800 bg-sentinel-900/60 hover:border-sentinel-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-sky-400" />
                    <div>
                      <p className="font-bold text-slate-100">{rpc.label}</p>
                      <p className="text-2xs text-slate-500">{rpc.url}</p>
                    </div>
                  </div>
                  {preferences.rpcEndpoint === rpc.id && <Badge variant="info">Active</Badge>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 3: Risk & Security Controls */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <Panel title="Account Risk Tolerance Profile" subtitle="Defines alert thresholds and trading warning triggers">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              {[
                { id: 'conservative', title: 'Conservative', desc: 'Strict threat detection, max warning alerts, low slippage limits.' },
                { id: 'moderate', title: 'Moderate (Recommended)', desc: 'Balanced threat warnings and execution freedom.' },
                { id: 'high', title: 'High Volatility', desc: 'Higher tolerance for low-liquidity memecoins and rapid price movement.' },
                { id: 'degenerate', title: 'Degenerate Mode', desc: 'Minimal safety friction for high-frequency sniper trading.' },
              ].map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleRiskChange(r.id as any)}
                  className={`p-4 rounded-xl border cursor-pointer transition space-y-2 ${
                    preferences.riskLevel === r.id
                      ? 'border-amber-500 bg-amber-950/20 text-slate-100'
                      : 'border-sentinel-800 bg-sentinel-900/60 hover:border-sentinel-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">{r.title}</span>
                    {preferences.riskLevel === r.id && <Badge variant="warning">Selected</Badge>}
                  </div>
                  <p className="text-slate-400 font-sans text-xs">{r.desc}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Session Security Auto-Lock Timer" subtitle="Automatically locks session after period of user inactivity">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {[15, 30, 60, 240].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleAutoLockChange(mins)}
                  className={`p-3 rounded-xl border text-center transition font-bold ${
                    preferences.autoLockMinutes === mins
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                      : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-slate-200'
                  }`}
                >
                  {mins === 60 ? '1 Hour' : mins === 240 ? '4 Hours' : `${mins} Minutes`}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 4: Display & Theme */}
      {activeTab === 'display' && (
        <div className="space-y-6">
          <Panel
            title="Interface Scale"
            subtitle="Resize the entire interface. Ctrl/⌘ with + or − adjusts, Ctrl/⌘ 0 resets to 100%"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => adjustUiScale(-10)}
                  disabled={uiScale <= UI_SCALE_MIN}
                  aria-label="Decrease interface scale"
                  className="h-8 w-8 shrink-0 rounded-md border border-sentinel-700 bg-sentinel-800 text-sentinel-200 hover:border-sentinel-600 hover:text-sentinel-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>

                <input
                  type="range"
                  min={UI_SCALE_MIN}
                  max={UI_SCALE_MAX}
                  step={5}
                  value={uiScale}
                  onChange={(e) => setUiScale(Number(e.target.value))}
                  aria-label="Interface scale percentage"
                  aria-valuetext={`${uiScale} percent`}
                  className="flex-1 accent-accent-500 cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => adjustUiScale(10)}
                  disabled={uiScale >= UI_SCALE_MAX}
                  aria-label="Increase interface scale"
                  className="h-8 w-8 shrink-0 rounded-md border border-sentinel-700 bg-sentinel-800 text-sentinel-200 hover:border-sentinel-600 hover:text-sentinel-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>

                <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-sentinel-100 tabular-nums">
                  {uiScale}%
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[50, 75, 100, 125, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setUiScale(preset)}
                    className={`rounded-md border px-2.5 py-1 font-mono text-2xs font-semibold transition-colors ${
                      uiScale === preset
                        ? 'border-accent-500 bg-accent-500/15 text-accent-300'
                        : 'border-sentinel-700 bg-sentinel-800 text-sentinel-400 hover:border-sentinel-600 hover:text-sentinel-100'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetUiScale}
                  className="ml-auto rounded-md border border-sentinel-700 bg-sentinel-800 px-2.5 py-1 font-mono text-2xs font-semibold text-sentinel-300 hover:border-sentinel-600 hover:text-sentinel-100 transition-colors"
                >
                  Reset
                </button>
              </div>

              {uiScale <= 40 && (
                <p className="text-2xs text-trading-warning">
                  At {uiScale}% the interface may be too small to read. Press Ctrl/⌘ 0 to return to 100%.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="UI Density Mode" subtitle="Adjust spacing for trading tables and data metrics">
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              {(['compact', 'standard', 'spacious'] as DensityMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDensity(mode)}
                  className={`p-3 rounded-xl border text-center transition capitalize font-bold ${
                    density === mode
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500 shadow-glow'
                      : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-slate-200'
                  }`}
                >
                  {mode} Mode
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Preferred Currency Display" subtitle="Primary denomination for portfolio and market values">
            <div className="grid grid-cols-4 gap-3 font-mono text-xs">
              {(['USD', 'SOL', 'EUR', 'BTC'] as const).map((curr) => (
                <button
                  key={curr}
                  onClick={() => handleCurrencyChange(curr)}
                  className={`p-3 rounded-xl border text-center transition font-bold ${
                    preferences.currencyDisplay === curr
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                      : 'bg-sentinel-950 text-slate-400 border-sentinel-800 hover:text-slate-200'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Accessibility & Motion" subtitle="Configure reduced motion and high-frequency animations">
            <div
              onClick={() => updatePreferences({ reducedMotion: !preferences.reducedMotion })}
              className="flex items-center justify-between p-3.5 rounded-xl border border-sentinel-800 bg-sentinel-900/60 cursor-pointer hover:border-sentinel-700 transition"
            >
              <div>
                <p className="font-bold text-slate-100 font-mono text-xs">Reduce Non-Essential Motion</p>
                <p className="text-2xs text-slate-400 font-sans">Disables pulsing glow effects, ticker animations, and rapid chart transitions.</p>
              </div>
              <div
                className={`h-6 w-11 rounded-full flex items-center p-1 transition ${
                  preferences.reducedMotion ? 'bg-sky-500 justify-end' : 'bg-sentinel-800 justify-start'
                }`}
              >
                <div className="h-4 w-4 rounded-full bg-white shadow-md" />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 5: Notifications */}
      {activeTab === 'notifications' && (
        <Panel title="Notification Preferences" subtitle="Control platform security alerts and push notifications">
          <div className="space-y-3 text-xs font-mono">
            {[
              { key: 'security', label: 'Security & Wallet Threats', desc: 'Alerts when suspicious holder clusters or insider transfers are detected.' },
              { key: 'priceAlerts', label: 'Price & Market Movement', desc: 'Notifications when watched tokens cross price thresholds.' },
              { key: 'tradeExecution', label: 'Trade Execution Confirmations', desc: 'Instant feedback on completed buy/sell orders.' },
              { key: 'system', label: 'System & RPC Status', desc: 'Updates on network latency and system status.' },
            ].map((n) => {
              const isEnabled = preferences.notificationsEnabled[n.key as keyof typeof preferences.notificationsEnabled];

              return (
                <div
                  key={n.key}
                  onClick={() => handleNotificationToggle(n.key as any)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-sentinel-800 bg-sentinel-900/60 cursor-pointer hover:border-sentinel-700 transition"
                >
                  <div>
                    <p className="font-bold text-slate-100">{n.label}</p>
                    <p className="text-2xs text-slate-400 font-sans">{n.desc}</p>
                  </div>
                  <div
                    className={`h-6 w-11 rounded-full flex items-center p-1 transition ${
                      isEnabled ? 'bg-sky-500 justify-end' : 'bg-sentinel-800 justify-start'
                    }`}
                  >
                    <div className="h-4 w-4 rounded-full bg-white shadow-md" />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
