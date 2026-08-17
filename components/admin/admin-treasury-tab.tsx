'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  PieChart,
  Sliders,
  TrendingUp,
  ShieldCheck,
  Lock,
  ArrowRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole } from '@/lib/admin/types';

interface AdminTreasuryTabProps {
  currentRole: AdminRole;
  onSimulateFeeChange: (currentFee: number, proposedFee: number) => void;
  onRequestFeeUpdate: (newFee: number, reason: string) => void;
}

export function AdminTreasuryTab({
  currentRole,
  onSimulateFeeChange,
  onRequestFeeUpdate,
}: AdminTreasuryTabProps) {
  const [swapFee, setSwapFee] = useState(0.35);
  const [proposedFee, setProposedFee] = useState(0.25);
  const [feeReason, setFeeReason] = useState('');

  return (
    <div className="space-y-6">
      {/* Treasury Balances Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Total Protocol Assets</span>
          <p className="text-xl font-bold text-emerald-400 font-mono">$14,820,500 USD</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Solana Reserves (SOL)</span>
          <p className="text-xl font-bold text-white font-mono">45,210.5 SOL</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">USDC Treasury Vault</span>
          <p className="text-xl font-bold text-sky-400 font-mono">$5,240,000</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">24h Net Protocol Revenue</span>
          <p className="text-xl font-bold text-emerald-400 font-mono">$142,850 USD</p>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <Panel className="p-5 bg-sentinel-900/40 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">24h Multi-Stream Revenue Attribution</h3>
          </div>
          <Badge variant="neutral" size="sm" className="font-mono text-xs">
            +14.2% DoD Growth
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">DEX Swap Fees (65.9%)</span>
            <p className="text-base font-bold text-white font-mono">$94,200 USD</p>
            <p className="text-2xs text-slate-400 font-mono">0.35% take-rate on $84.2M volume</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">Launchpad Fees (19.9%)</span>
            <p className="text-base font-bold text-white font-mono">$28,400 USD</p>
            <p className="text-2xs text-slate-400 font-mono">14 creations + 3 graduations</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">AI Subscriptions (8.7%)</span>
            <p className="text-base font-bold text-white font-mono">$12,500 USD</p>
            <p className="text-2xs text-slate-400 font-mono">255 new Sentinel AI Pro seats</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-2xs text-slate-500 font-mono uppercase">API Ingestion Revenue (5.5%)</span>
            <p className="text-base font-bold text-white font-mono">$7,750 USD</p>
            <p className="text-2xs text-slate-400 font-mono">26 developer API subscriptions</p>
          </div>
        </div>
      </Panel>

      {/* Dynamic Fee Configuration & Action Simulator */}
      <Panel className="p-5 bg-sentinel-900/60 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Dynamic Fee Governance & Simulator</h3>
          </div>
          <Badge variant="warning" size="sm" className="font-mono text-xs">
            Dual Approval Required
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 font-medium mb-1">
                Current DEX Swap Fee: <span className="text-white font-bold">{swapFee}%</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.05}
                  max={1.5}
                  step={0.05}
                  value={proposedFee}
                  onChange={(e) => setProposedFee(parseFloat(e.target.value))}
                  className="flex-1 accent-sky-400"
                />
                <span className="text-sm font-bold font-mono text-sky-400 w-14 text-right">
                  {proposedFee.toFixed(2)}%
                </span>
              </div>
            </div>

            <input
              type="text"
              value={feeReason}
              onChange={(e) => setFeeReason(e.target.value)}
              placeholder="Mandatory justification reason for fee adjustment..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
            />
          </div>

          <div className="flex flex-col justify-between p-4 rounded-xl bg-sentinel-950/80 border border-white/5 space-y-3">
            <div className="text-xs text-slate-300 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Proposed Change:</span>
                <span className="text-white font-bold">{swapFee}% → {proposedFee}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Governance Gate:</span>
                <span className="text-amber-400 font-bold">Requires Finance + SuperAdmin</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSimulateFeeChange(swapFee, proposedFee)}
              >
                <Eye className="h-3 w-3 mr-1" />
                Simulate Revenue Impact
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onRequestFeeUpdate(proposedFee, feeReason || 'Fee rate adjustment')}
              >
                Submit Dual-Approval Request
              </Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
