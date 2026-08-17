'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Zap, Eye, Copy, ShieldCheck, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { useAppActions } from '@/lib/store';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { Decimal } from '@/lib/math/decimal';
import { WhyThisToken } from './why-this-token';
import { detectAnomalies, getAnomalyIcon, getHighestSeverity } from '@/lib/discovery/anomaly-detector';
import { TokenSocials } from '@/components/ui/token-socials';

interface TokenDiscoveryCardProps {
  token: DiscoveryToken;
  variant?: 'compact' | 'expanded';
}

export function TokenDiscoveryCard({ token, variant = 'expanded' }: TokenDiscoveryCardProps) {
  const { setQuickBuyOpen } = useAppActions();
  const [copied, setCopied] = useState(false);
  const anomalies = useMemo(() => detectAnomalies(token), [token]);
  const highestSeverity = getHighestSeverity(anomalies);

  const priceDec = new Decimal(token.priceUsd);
  const mcapDec = new Decimal(token.marketCapUsd);
  const liqDec = new Decimal(token.liquidityUsd);
  const vol24hDec = new Decimal(token.volume24hUsd);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickBuyOpen(true, {
      name: token.name,
      symbol: token.symbol,
      mint: token.mint,
      price: priceDec.formatUSD(4),
      mcap: mcapDec.formatUSD(0),
    });
  };

  return (
    <Panel variant="default" className="hover:border-sentinel-600 transition-all font-mono">
      <div className="space-y-3">
        {/* Card Header: Identity & Discovery Score Badge */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-750 font-bold text-sky-400 border border-sentinel-600 text-sm">
              {token.symbol.slice(0, 2)}
            </div>
            <div>
              <Link
                href={`/trade/solana/${token.mint}`}
                className="font-bold text-slate-100 text-sm hover:text-sky-400 flex items-center gap-1.5"
              >
                {token.name} <span className="text-slate-400 text-xs">${token.symbol}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-2xs text-slate-400 mt-0.5">
                <span className="text-sky-300 font-bold">{token.source}</span>
                <span>•</span>
                <span>{token.ageFormatted}</span>
                <span>•</span>
                <button onClick={handleCopyAddress} className="hover:text-slate-200">
                  {copied ? 'Copied!' : `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`}
                </button>
                <TokenSocials symbol={token.symbol} showHandles={false} size="xs" />
              </div>
            </div>
          </div>

          {/* Discovery Score Badge (0 - 100) */}
          <div className="text-right">
            <Badge
              variant={
                token.discoveryScore.totalScore >= 80
                  ? 'success'
                  : token.discoveryScore.totalScore >= 60
                  ? 'info'
                  : 'warning'
              }
              size="md"
              className="font-mono font-bold"
            >
              Score {token.discoveryScore.totalScore}/100
            </Badge>
            <p className="text-2xs text-slate-500 mt-0.5">Sentinel Discovery</p>
          </div>
        </div>

        {/* Anomaly Badges */}
        {anomalies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {anomalies.slice(0, 3).map((anomaly, idx) => (
              <Badge
                key={idx}
                variant={
                  anomaly.severity === 'critical' ? 'danger'
                    : anomaly.severity === 'high' ? 'warning'
                    : 'info'
                }
                size="sm"
                className="font-mono text-2xs"
              >
                {getAnomalyIcon(anomaly.type)} {anomaly.label}
              </Badge>
            ))}
            {anomalies.length > 3 && (
              <Badge variant="neutral" size="sm" className="font-mono text-2xs">
                +{anomalies.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Price & Primary Financial Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 bg-sentinel-950 p-2.5 rounded-xl border border-sentinel-800 text-xs">
          <div>
            <p className="text-2xs text-slate-500">PRICE</p>
            <p className="font-bold text-slate-100">{priceDec.formatUSD(4)}</p>
            <p className={`text-2xs font-bold ${token.priceChange15m >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {token.priceChange15m >= 0 ? '+' : ''}{token.priceChange15m.toFixed(1)}% 15m
            </p>
          </div>

          <div>
            <p className="text-2xs text-slate-500">MARKET CAP</p>
            <p className="font-bold text-slate-200">{mcapDec.formatUSD(0)}</p>
            <p className={`text-2xs font-bold ${token.liquidityChange1hPct >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              Liq {token.liquidityChange1hPct >= 0 ? '+' : ''}{token.liquidityChange1hPct.toFixed(1)}%
            </p>
          </div>

          <div>
            <p className="text-2xs text-slate-500">BUY PRESSURE</p>
            <p className="font-bold text-emerald-400">{(token.buyPressureRatio * 100).toFixed(0)}%</p>
            <p className="text-2xs text-slate-400">TX accel {token.txAccelerationPct?.toFixed(0) ?? 0}%</p>
          </div>
        </div>

        {/* Expanded View Metrics & Actions */}
        {variant === 'expanded' && (
          <div className="space-y-3 pt-1">
            <WhyThisToken score={token.discoveryScore} symbol={token.symbol} />

            <div className="flex items-center justify-between pt-1 border-t border-sentinel-800">
              <Link href={`/trade/solana/${token.mint}`}>
                <Button variant="outline" size="xs" leftIcon={<Eye className="h-3 w-3 text-sky-400" />}>
                  Inspect Token
                </Button>
              </Link>
              <Button
                variant="buy"
                size="xs"
                onClick={handleQuickBuy}
                leftIcon={<Zap className="h-3 w-3 fill-current" />}
              >
                Quick Swap
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
