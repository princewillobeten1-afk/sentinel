'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Check,
  TrendingUp,
  UserCheck,
  ExternalLink,
  Zap,
  Clock,
  BarChart2,
  ChevronRight,
  Flame,
  Award,
} from 'lucide-react';
import { formatCompactUsd } from '@/lib/discovery/format';
import { TrackedWalletCategory } from '@/lib/store/tracked-wallets-store';

export interface SmartMoneyTrader {
  id: string;
  address: string;
  fullAddress: string;
  label: string;
  category: TrackedWalletCategory;
  scoreOverall: number;
  winRate: number;
  totalRealizedPnl: number;
  pnl7d?: number;
  pnl30d?: number;
  tradeCount: number;
  avgHoldingTime: string;
  copyableScore: number;
  styleClassification: string;
  tokenSymbol?: string;
  tokenMint?: string;
}

interface SmartMoneyCardProps {
  trader: SmartMoneyTrader;
  rank?: number;
  isTracked: boolean;
  onToggleTrack: (trader: SmartMoneyTrader) => void;
  onSimulateCopy?: (trader: SmartMoneyTrader) => void;
  onSelect?: (trader: SmartMoneyTrader) => void;
}

export function SmartMoneyCard({
  trader,
  rank,
  isTracked,
  onToggleTrack,
  onSimulateCopy,
  onSelect,
}: SmartMoneyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(trader.fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const getRankBadge = (r?: number) => {
    if (!r) return null;
    if (r === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
          <Award className="w-3 h-3 text-amber-400" /> #1 ALPHA
        </span>
      );
    }
    if (r === 2) {
      return (
        <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-slate-400/20 text-slate-200 border border-slate-400/40 flex items-center gap-1">
          #2 RANK
        </span>
      );
    }
    if (r === 3) {
      return (
        <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-bold bg-amber-700/20 text-amber-500 border border-amber-700/40 flex items-center gap-1">
          #3 RANK
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-3xs font-mono text-slate-400 bg-sentinel-900 border border-sentinel-800">
        #{r}
      </span>
    );
  };

  // Generate mini sparkline points for upward trajectory
  const sparklinePoints = '0,28 15,22 30,25 45,16 60,18 75,9 90,12 105,4 120,2';

  const winsCount = Math.round((trader.tradeCount * trader.winRate) / 100);
  const lossCount = Math.max(1, trader.tradeCount - winsCount);

  return (
    <Card
      onClick={() => onSelect?.(trader)}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden border-sentinel-800 bg-sentinel-900/55 transition-colors duration-200 hover:border-sky-400/40 hover:bg-sentinel-900/80"
    >
      {/* Top Accent Gradient Border */}
      <div className="absolute inset-x-0 top-0 h-px bg-sky-400/60 opacity-0 transition-opacity group-hover:opacity-100" />

      <CardHeader className="border-b border-sentinel-800/80 p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {getRankBadge(rank)}
              <h3 className="font-bold text-white text-sm truncate group-hover:text-sky-300 transition-colors flex items-center gap-1">
                {trader.label}
              </h3>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={getCategoryBadgeVariant(trader.category)} size="sm">
                {trader.category.replace('_', ' ')}
              </Badge>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-3xs text-slate-500 transition hover:bg-sentinel-950 hover:text-slate-200"
                title="Click to copy full address"
              >
                <span>{trader.address}</span>
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>

              <a
                href={`https://solscan.io/account/${trader.fullAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-slate-500 hover:text-sky-300 p-0.5 transition"
                title="View on Solscan Explorer"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Alpha Score Ring */}
          <div className="shrink-0 text-right">
            <span className="mb-0.5 block font-mono text-[9px] uppercase text-slate-500">Score</span>
            <span className="font-numeric text-lg font-semibold tabular-nums text-emerald-300">
              {trader.scoreOverall}
              <span className="text-3xs text-slate-500 font-normal">/100</span>
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        {/* Visual Win/Loss Ratio Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs font-mono">
            <span className="text-slate-400">Wins vs Losses</span>
            <span className="font-bold">
              <strong className="text-emerald-400">{winsCount}W</strong>
              <span className="text-slate-600 mx-1">/</span>
              <strong className="text-rose-400">{lossCount}L</strong>
            </span>
          </div>

          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-sentinel-800">
            <div
              style={{ width: `${trader.winRate}%` }}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full"
              title={`Win Rate: ${trader.winRate}%`}
            />
            <div
              style={{ width: `${100 - trader.winRate}%` }}
              className="bg-gradient-to-r from-rose-500 to-red-600 h-full"
              title={`Loss Rate: ${(100 - trader.winRate).toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Metric Badges Ribbon & Mini Sparkline */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-sentinel-800/80 py-3 text-xs font-numeric">
          <div>
            <span className="mb-1 block font-mono text-[9px] uppercase text-slate-500">Win rate</span>
            <span className="flex items-center gap-1 font-mono text-sm font-semibold text-emerald-300">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              {trader.winRate}%
            </span>
          </div>

          <div>
            <span className="mb-1 block font-mono text-[9px] uppercase text-slate-500">Realized P&L</span>
            <span className="flex items-center font-mono text-sm font-semibold text-emerald-300">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5 text-emerald-400 shrink-0" />
              +${formatCompactUsd(trader.totalRealizedPnl)}
            </span>
          </div>

          <div>
            <span className="mb-1 block font-mono text-[9px] uppercase text-slate-500">Avg. hold</span>
            <span className="flex items-center gap-1 font-mono text-xs font-medium text-slate-200">
              <Clock className="w-3 h-3 text-slate-400" /> {trader.avgHoldingTime}
            </span>
          </div>

          <div>
            <span className="mb-1 block font-mono text-[9px] uppercase text-slate-500">7D realized</span>
            <span className="font-mono text-xs font-semibold text-sky-300">
              +${formatCompactUsd(trader.pnl7d || trader.totalRealizedPnl * 0.18)}
            </span>
          </div>
        </div>

        {/* Style, Top Token & Mini Curve */}
        <div className="flex items-center justify-between gap-2 text-2xs text-slate-400">
          <div className="min-w-0 truncate">
            <span className="truncate rounded bg-sentinel-800/60 px-2 py-1 text-slate-300">
              {trader.styleClassification}
            </span>
          </div>

          {/* Mini Sparkline Curve */}
          <div className="shrink-0 flex items-center gap-1 text-emerald-400">
            <svg width="60" height="18" viewBox="0 0 120 30" className="overflow-visible">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelect?.(trader)}
            className="flex-1 text-xs border-sky-500/30 hover:border-sky-500/60 text-sky-300 hover:bg-sky-500/10"
            leftIcon={<BarChart2 className="w-3.5 h-3.5 text-sky-400" />}
          >
            Wins & Losses
          </Button>

          <Button
            size="sm"
            variant={isTracked ? 'secondary' : 'primary'}
            onClick={() => onToggleTrack(trader)}
            className="text-xs px-3"
            leftIcon={isTracked ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <UserCheck className="w-3.5 h-3.5" />}
          >
            {isTracked ? 'Tracked' : 'Track'}
          </Button>

          {onSimulateCopy && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSimulateCopy(trader)}
              className="text-xs border-sentinel-700 hover:bg-sentinel-800 text-slate-300 px-2"
              title="Configure copy trade simulation"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
