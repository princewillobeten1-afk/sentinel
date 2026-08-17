'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Zap, Eye, ChevronDown, ChevronUp, Activity, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { useAppActions } from '@/lib/store';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { Decimal } from '@/lib/math/decimal';
import { detectAnomalies, getAnomalyIcon } from '@/lib/discovery/anomaly-detector';
import { WhyThisToken } from './why-this-token';

interface DiscoveryMobileCardProps {
  token: DiscoveryToken;
}

export function DiscoveryMobileCard({ token }: DiscoveryMobileCardProps) {
  const { setQuickBuyOpen } = useAppActions();
  const [isExpanded, setIsExpanded] = useState(false);

  const priceDec = new Decimal(token.priceUsd);
  const mcapDec = new Decimal(token.marketCapUsd);
  const liqDec = new Decimal(token.liquidityUsd);
  const volDec = new Decimal(token.volume24hUsd);
  const buyPct = Math.round(token.buyPressureRatio * 100);
  const isUp = token.priceChange15m >= 0;
  const anomalies = detectAnomalies(token);

  return (
    <Panel variant="default" className="font-mono text-xs hover:border-sentinel-700 transition-all">
      <div className="space-y-3">
        {/* Top Header Row: Symbol, Price, Discovery Score Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sentinel-800 font-bold text-sky-400 border border-sentinel-700 text-xs shrink-0">
              {token.symbol.slice(0, 2)}
            </div>
            <div>
              <Link
                href={`/trade/solana/${token.mint}`}
                className="font-bold text-slate-100 text-sm hover:text-sky-400 flex items-center gap-1"
              >
                {token.name} <span className="text-slate-400 text-xs">${token.symbol}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <div className="flex items-center gap-2 text-2xs text-slate-400">
                <span className="text-sky-400 font-bold">{token.source}</span>
                <span>•</span>
                <span>{token.ageFormatted}</span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <Badge
              variant={
                token.discoveryScore.totalScore >= 80
                  ? 'success'
                  : token.discoveryScore.totalScore >= 60
                  ? 'info'
                  : 'warning'
              }
              size="sm"
              className="font-bold"
            >
              Score {token.discoveryScore.totalScore}
            </Badge>
          </div>
        </div>

        {/* Primary Signals Bar: Price, 15m Change, Buy-side Ratio */}
        <div className="grid grid-cols-3 gap-2 bg-sentinel-950 p-2 rounded-xl border border-sentinel-800 text-center">
          <div>
            <span className="text-2xs text-slate-500 uppercase block font-bold">Price</span>
            <span className="font-bold text-slate-100">{priceDec.formatUSD(4)}</span>
          </div>

          <div>
            <span className="text-2xs text-slate-500 uppercase block font-bold">15m Change</span>
            <span
              className={`font-bold inline-flex items-center gap-0.5 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <span>{isUp ? '▲' : '▼'}</span>
              <span>{isUp ? '+' : ''}{token.priceChange15m.toFixed(1)}%</span>
            </span>
          </div>

          <div>
            <span className="text-2xs text-slate-500 uppercase block font-bold">Market Cap</span>
            <span className="font-bold text-slate-200">{mcapDec.formatUSD(0)}</span>
          </div>
        </div>

        {/* Anomaly Badges */}
        {anomalies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {anomalies.slice(0, 2).map((anom, idx) => (
              <Badge key={idx} variant={anom.severity === 'critical' ? 'danger' : 'warning'} size="sm" className="text-2xs">
                {getAnomalyIcon(anom.type)} {anom.label}
              </Badge>
            ))}
          </div>
        )}

        {/* Quick Action Buttons & Expand Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-sentinel-800">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-2xs text-sky-400 font-bold hover:text-sky-300 transition"
          >
            <span>{isExpanded ? 'Less info' : 'More info'}</span>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <div className="flex items-center gap-2">
            <Link href={`/trade/solana/${token.mint}`}>
              <Button variant="outline" size="xs">
                Inspect
              </Button>
            </Link>
            <Button
              variant="buy"
              size="xs"
              onClick={() => setQuickBuyOpen(true, {
                name: token.name,
                symbol: token.symbol,
                mint: token.mint,
                price: priceDec.formatUSD(4),
                mcap: mcapDec.formatUSD(0),
              })}
              leftIcon={<Zap className="h-3 w-3 fill-current" />}
            >
              Swap
            </Button>
          </div>
        </div>

        {/* Expandable Secondary Signal Detail Panel */}
        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-sentinel-800/80 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-sentinel-950 p-2.5 rounded-xl border border-sentinel-800">
              <div>
                <span className="text-2xs text-slate-500 uppercase block font-bold">Liquidity</span>
                <span className="font-bold text-slate-200">{liqDec.formatUSD(0)}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-500 uppercase block font-bold">24h Volume</span>
                <span className="font-bold text-slate-200">{volDec.formatUSD(0)}</span>
              </div>
              <div>
                <span className="text-2xs text-slate-500 uppercase block font-bold">Buy-side Ratio</span>
                <span className="font-bold text-emerald-400">{buyPct}% Buy</span>
              </div>
              <div>
                <span className="text-2xs text-slate-500 uppercase block font-bold">Holders</span>
                <span className="font-bold text-slate-300">{token.holdersCount.toLocaleString()}</span>
              </div>
            </div>

            <WhyThisToken score={token.discoveryScore} symbol={token.symbol} />
          </div>
        )}
      </div>
    </Panel>
  );
}
