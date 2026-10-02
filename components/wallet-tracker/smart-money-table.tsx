'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  UserCheck,
  Zap,
  BarChart2,
  Clock,
  Award,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCompactUsd } from '@/lib/discovery/format';
import { SmartMoneyTrader } from '@/components/wallet-tracker/smart-money-card';

interface SmartMoneyTableProps {
  traders: SmartMoneyTrader[];
  isTracked: (address: string) => boolean;
  onToggleTrack: (trader: SmartMoneyTrader) => void;
  onSimulateCopy?: (trader: SmartMoneyTrader) => void;
  onSelect: (trader: SmartMoneyTrader) => void;
}

export function SmartMoneyTable({
  traders,
  isTracked,
  onToggleTrack,
  onSimulateCopy,
  onSelect,
}: SmartMoneyTableProps) {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, addr: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'WHALE':
        return 'purple';
      case 'KOL':
        return 'info';
      case 'SNIPER':
        return 'warning';
      case 'SMART_MONEY':
      default:
        return 'success';
    }
  };

  const sparklinePoints = '0,24 15,19 30,22 45,14 60,16 75,8 90,11 105,4 120,2';

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-sentinel-800 bg-sentinel-950 shadow-md">
      <table className="w-full text-left text-xs font-numeric border-collapse">
        <thead>
          <tr className="border-b border-sentinel-800 bg-sentinel-900/80 text-slate-400 font-mono text-3xs uppercase tracking-wider">
            <th className="py-3 px-3 w-12 text-center">Rank</th>
            <th className="py-3 px-4">Trader / Wallet</th>
            <th className="py-3 px-3">Category</th>
            <th className="py-3 px-3 text-right">Alpha Score</th>
            <th className="py-3 px-4 min-w-[160px]">Win Rate & Outcomes</th>
            <th className="py-3 px-4 text-right">Realized Net P&L</th>
            <th className="py-3 px-3 text-right">7D P&L</th>
            <th className="py-3 px-3">Avg Hold</th>
            <th className="py-3 px-3 text-center">Performance Trend</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sentinel-800/60">
          {traders.map((trader, idx) => {
            const rank = idx + 1;
            const tracked = isTracked(trader.fullAddress);
            const wins = Math.round((trader.tradeCount * trader.winRate) / 100);
            const losses = Math.max(1, trader.tradeCount - wins);

            return (
              <tr
                key={trader.id}
                onClick={() => onSelect(trader)}
                className="hover:bg-sky-500/[0.04] transition cursor-pointer group"
              >
                {/* Rank */}
                <td className="py-3 px-3 text-center font-mono">
                  {rank === 1 ? (
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 inline-flex items-center justify-center font-bold text-3xs mx-auto">
                      1
                    </span>
                  ) : rank === 2 ? (
                    <span className="w-6 h-6 rounded-full bg-slate-400/20 text-slate-200 border border-slate-400/50 inline-flex items-center justify-center font-bold text-3xs mx-auto">
                      2
                    </span>
                  ) : rank === 3 ? (
                    <span className="w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/50 inline-flex items-center justify-center font-bold text-3xs mx-auto">
                      3
                    </span>
                  ) : (
                    <span className="text-slate-500 text-2xs">#{rank}</span>
                  )}
                </td>

                {/* Trader Name & Address */}
                <td className="py-3 px-4">
                  <div className="font-bold text-white group-hover:text-sky-300 transition truncate max-w-[200px]">
                    {trader.label}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, trader.fullAddress)}
                      className="font-mono text-3xs text-slate-400 hover:text-white flex items-center gap-1 bg-sentinel-900 px-1 rounded border border-sentinel-800"
                    >
                      <span>{trader.address}</span>
                      {copiedAddr === trader.fullAddress ? (
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-slate-500" />
                      )}
                    </button>
                    <a
                      href={`https://solscan.io/account/${trader.fullAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-500 hover:text-sky-300"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </td>

                {/* Category */}
                <td className="py-3 px-3">
                  <Badge variant={getCategoryBadgeVariant(trader.category)} size="sm">
                    {trader.category.replace('_', ' ')}
                  </Badge>
                </td>

                {/* Alpha Score */}
                <td className="py-3 px-3 text-right">
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {trader.scoreOverall}
                  </span>
                  <span className="text-3xs text-slate-500">/100</span>
                </td>

                {/* Win Rate & Bar */}
                <td className="py-3 px-4">
                  <div className="flex items-center justify-between text-2xs font-mono mb-1">
                    <span className="font-bold text-emerald-400">{trader.winRate}%</span>
                    <span className="text-slate-500 text-3xs">
                      {wins}W / {losses}L
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-sentinel-900 rounded-full overflow-hidden flex border border-sentinel-800">
                    <div
                      style={{ width: `${trader.winRate}%` }}
                      className="bg-emerald-500 h-full"
                    />
                    <div
                      style={{ width: `${100 - trader.winRate}%` }}
                      className="bg-rose-500 h-full"
                    />
                  </div>
                </td>

                {/* Realized PnL */}
                <td className="py-3 px-4 text-right">
                  <div className="font-bold text-emerald-400 font-mono text-sm">
                    +${formatCompactUsd(trader.totalRealizedPnl)}
                  </div>
                  <div className="text-3xs text-slate-500 font-mono">{trader.tradeCount} trades</div>
                </td>

                {/* 7D PnL */}
                <td className="py-3 px-3 text-right">
                  <span className="font-bold text-sky-400 font-mono text-xs">
                    +${formatCompactUsd(trader.pnl7d || trader.totalRealizedPnl * 0.18)}
                  </span>
                </td>

                {/* Hold Time */}
                <td className="py-3 px-3 text-slate-300 font-mono text-2xs">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {trader.avgHoldingTime}
                  </span>
                </td>

                {/* Sparkline Curve */}
                <td className="py-3 px-3 text-center">
                  <svg width="70" height="18" viewBox="0 0 120 30" className="inline-block">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparklinePoints}
                    />
                  </svg>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelect(trader)}
                      className="text-xs px-2 h-7 border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
                      title="Inspect Win/Loss Performance & Charts"
                    >
                      <BarChart2 className="w-3 h-3 mr-1" /> Inspect
                    </Button>

                    <Button
                      size="sm"
                      variant={tracked ? 'secondary' : 'primary'}
                      onClick={() => onToggleTrack(trader)}
                      className="text-xs px-2.5 h-7"
                    >
                      {tracked ? <Check className="w-3 h-3 text-emerald-400" /> : <UserCheck className="w-3 h-3" />}
                    </Button>

                    {onSimulateCopy && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSimulateCopy(trader)}
                        className="text-xs px-2 h-7 border-sentinel-700 hover:bg-sentinel-800 text-slate-300"
                        title="Simulate copy trade"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
