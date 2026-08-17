'use client';

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AdminTradingTabProps {
  onInspectOrder: (orderId: string) => void;
}

export function AdminTradingTab({ onInspectOrder }: AdminTradingTabProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">24h Orders Processed</span>
          <p className="text-xl font-bold text-white font-mono">421,802</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Avg Execution Latency</span>
          <p className="text-xl font-bold text-sky-400 font-mono">142ms</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Avg Realized Slippage</span>
          <p className="text-xl font-bold text-emerald-400 font-mono">0.14%</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Failed Trade Rate</span>
          <p className="text-xl font-bold text-rose-400 font-mono">0.009% (38 txs)</p>
        </div>
      </div>

      {/* Router Routing Distribution & Latency */}
      <Panel className="p-4 bg-sentinel-900/40 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">DEX Routing Volume Distribution & Latency</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white">Raydium CPMM</span>
              <span className="text-xs font-mono text-sky-400">48.2%</span>
            </div>
            <p className="text-2xs text-slate-500 font-mono">Latency: 110ms • Errors: 0.002%</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white">Jupiter Smart Router</span>
              <span className="text-xs font-mono text-sky-400">36.4%</span>
            </div>
            <p className="text-2xs text-slate-500 font-mono">Latency: 145ms • Errors: 0.004%</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white">Orca Whirlpools</span>
              <span className="text-xs font-mono text-sky-400">11.2%</span>
            </div>
            <p className="text-2xs text-slate-500 font-mono">Latency: 125ms • Errors: 0.001%</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white">Uniswap v3 (Base)</span>
              <span className="text-xs font-mono text-sky-400">4.2%</span>
            </div>
            <p className="text-2xs text-slate-500 font-mono">Latency: 180ms • Errors: 0.005%</p>
          </div>
        </div>
      </Panel>

      {/* Failed Trades Diagnostic Explorer */}
      <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white">Failed Trade Investigation Console</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Real-time simulation error logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                <th className="p-3.5">Transaction / Order</th>
                <th className="p-3.5">Trader Wallet</th>
                <th className="p-3.5">Pair</th>
                <th className="p-3.5">Failure Reason</th>
                <th className="p-3.5">Gas Spent</th>
                <th className="p-3.5">Time</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              <tr className="hover:bg-white/[0.02] transition">
                <td className="p-3.5 text-rose-400 font-bold">5xFail...88a1</td>
                <td className="p-3.5 text-slate-300">7xK9...3a19</td>
                <td className="p-3.5 text-slate-200">SOL / $SOLM</td>
                <td className="p-3.5 text-slate-400">Slippage Exceeded (Price moved &gt;15% in slot)</td>
                <td className="p-3.5 text-slate-500">0.00005 SOL</td>
                <td className="p-3.5 text-slate-500">12m ago</td>
                <td className="p-3.5 text-right">
                  <Button variant="outline" size="sm" onClick={() => onInspectOrder('ord_fail_01')} className="text-2xs h-7">
                    Trace Order
                  </Button>
                </td>
              </tr>
              <tr className="hover:bg-white/[0.02] transition">
                <td className="p-3.5 text-rose-400 font-bold">3xFail...44c2</td>
                <td className="p-3.5 text-slate-300">2zW1...99k0</td>
                <td className="p-3.5 text-slate-200">SOL / $CYBER</td>
                <td className="p-3.5 text-slate-400">RPC Simulation Timeout (&gt;1200ms)</td>
                <td className="p-3.5 text-slate-500">0.00001 SOL</td>
                <td className="p-3.5 text-slate-500">24m ago</td>
                <td className="p-3.5 text-right">
                  <Button variant="outline" size="sm" onClick={() => onInspectOrder('ord_fail_02')} className="text-2xs h-7">
                    Trace Order
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
