'use client';

import React, { useState } from 'react';
import {
  Radio,
  AlertTriangle,
  Lock,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  Zap,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TradingEmergencyMode, EmergencyPlatformState, AdminRole } from '@/lib/admin/types';

interface AdminEmergencySwitchboardProps {
  currentRole: AdminRole;
  state: EmergencyPlatformState;
  onSetMode: (mode: TradingEmergencyMode, reason: string) => void;
  onToggleSwitch: (key: any, value: any, reason: string) => void;
  onSimulateEscalation: (targetMode: TradingEmergencyMode) => void;
  onRequestDualApproval: (actionType: any, payload: any, reason: string) => void;
}

const EMERGENCY_MODES: Array<{
  id: TradingEmergencyMode;
  label: string;
  desc: string;
  variant: 'success' | 'warning' | 'danger';
}> = [
  { id: 'NORMAL', label: 'NORMAL', desc: 'Full standard operation across all pairs & routers', variant: 'success' },
  { id: 'DEGRADED', label: 'DEGRADED', desc: 'Throttled polling & RPC rate limits active', variant: 'warning' },
  { id: 'TRADING_RESTRICTED', label: 'RESTRICTED', desc: 'High-slippage pairs disabled; only position exits allowed', variant: 'warning' },
  { id: 'TRADING_PAUSED', label: 'TRADING PAUSED', desc: 'Complete freeze on all new DEX orders', variant: 'danger' },
  { id: 'FULL_EMERGENCY', label: 'FULL EMERGENCY', desc: 'Protocol lockdown: trading, launches & withdrawals frozen', variant: 'danger' },
];

export function AdminEmergencySwitchboard({
  currentRole,
  state,
  onSetMode,
  onToggleSwitch,
  onSimulateEscalation,
  onRequestDualApproval,
}: AdminEmergencySwitchboardProps) {
  const [selectedTargetMode, setSelectedTargetMode] = useState<TradingEmergencyMode>(state.mode);
  const [reasonInput, setReasonInput] = useState('');

  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const handleModeChange = (mode: TradingEmergencyMode) => {
    if (mode === 'FULL_EMERGENCY' || mode === 'TRADING_PAUSED') {
      // Require Dual Approval
      onRequestDualApproval(
        mode === 'FULL_EMERGENCY' ? 'FULL_EMERGENCY_TRIGGER' : 'GLOBAL_TRADING_PAUSE',
        { targetMode: mode },
        reasonInput || `Manual escalation to ${mode}`
      );
    } else {
      onSetMode(mode, reasonInput || `Emergency mode transitioned to ${mode}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Master Emergency Mode Selector */}
      <Panel className="p-5 bg-sentinel-900/60 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-rose-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white">Platform Operating State & Emergency Selector</h3>
          </div>
          <Badge
            variant={state.mode === 'NORMAL' ? 'success' : state.mode === 'DEGRADED' ? 'warning' : 'danger'}
            size="sm"
            className="font-mono text-xs"
          >
            ACTIVE: {state.mode}
          </Badge>
        </div>

        {/* 5-Mode Radio Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {EMERGENCY_MODES.map((m) => {
            const isActive = state.mode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedTargetMode(m.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? m.variant === 'danger'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : m.variant === 'warning'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-100'
                      : 'bg-emerald-500/20 border-emerald-500 text-emerald-100'
                    : selectedTargetMode === m.id
                    ? 'bg-white/[0.08] border-sky-400/60 text-white'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-mono">{m.label}</span>
                    {isActive && <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
                  </div>
                  <p className="text-2xs opacity-80 line-clamp-2">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Controls for Selected Mode */}
        {selectedTargetMode !== state.mode && (
          <div className="p-4 rounded-xl bg-sentinel-950/80 border border-sky-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-300">
                Escalation Target: {selectedTargetMode}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSimulateEscalation(selectedTargetMode)}
                className="text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                Simulate Impact
              </Button>
            </div>

            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Mandatory justification reason for emergency transition..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTargetMode(state.mode)}>
                Cancel
              </Button>
              <Button
                variant={selectedTargetMode === 'NORMAL' ? 'primary' : 'danger'}
                size="sm"
                onClick={() => handleModeChange(selectedTargetMode)}
              >
                {selectedTargetMode === 'FULL_EMERGENCY' || selectedTargetMode === 'TRADING_PAUSED'
                  ? 'Request Dual-Approval Escalation'
                  : 'Apply Mode Transition'}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* 2. Granular Targeted Subsystem Kill Switches */}
      <Panel className="p-5 bg-sentinel-900/60 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Granular Subsystem Kill Switches</h3>
          </div>
          <span className="text-xs text-slate-400">Targeted isolation without full protocol freeze</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Pause New Trades */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">New DEX Orders</p>
              <p className="text-2xs text-slate-500">Block incoming swaps</p>
            </div>
            <button
              onClick={() =>
                onToggleSwitch('pauseNewTrades', !state.killSwitches.pauseNewTrades, 'Toggled new trades kill switch')
              }
              className={`px-2.5 py-1 rounded-lg text-2xs font-bold font-mono transition ${
                state.killSwitches.pauseNewTrades
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {state.killSwitches.pauseNewTrades ? 'PAUSED' : 'ACTIVE'}
            </button>
          </div>

          {/* Pause Withdrawals */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Withdrawals</p>
              <p className="text-2xs text-slate-500">Asset outflows</p>
            </div>
            <button
              onClick={() =>
                onToggleSwitch('pauseWithdrawals', !state.killSwitches.pauseWithdrawals, 'Toggled withdrawals kill switch')
              }
              className={`px-2.5 py-1 rounded-lg text-2xs font-bold font-mono transition ${
                state.killSwitches.pauseWithdrawals
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {state.killSwitches.pauseWithdrawals ? 'LOCKED' : 'ACTIVE'}
            </button>
          </div>

          {/* Pause Copy Trading */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Copy Trading</p>
              <p className="text-2xs text-slate-500">Automated mirroring</p>
            </div>
            <button
              onClick={() =>
                onToggleSwitch('pauseCopyTrading', !state.killSwitches.pauseCopyTrading, 'Toggled copy trading kill switch')
              }
              className={`px-2.5 py-1 rounded-lg text-2xs font-bold font-mono transition ${
                state.killSwitches.pauseCopyTrading
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {state.killSwitches.pauseCopyTrading ? 'PAUSED' : 'ACTIVE'}
            </button>
          </div>

          {/* Pause Launchpad */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Token Launchpad</p>
              <p className="text-2xs text-slate-500">Bonding pool creations</p>
            </div>
            <button
              onClick={() =>
                onToggleSwitch('pauseLaunchpad', !state.killSwitches.pauseLaunchpad, 'Toggled launchpad kill switch')
              }
              className={`px-2.5 py-1 rounded-lg text-2xs font-bold font-mono transition ${
                state.killSwitches.pauseLaunchpad
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {state.killSwitches.pauseLaunchpad ? 'PAUSED' : 'ACTIVE'}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
