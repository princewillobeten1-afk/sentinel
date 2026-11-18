'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Users, Shield, Target, Boxes, Wallet, Trophy, BadgeDollarSign } from 'lucide-react';
import { MetricValue } from '@/components/ui/metric-value';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { toValueState } from '@/lib/ui/value-state';
import { formatCompactUsd, formatCount, formatDisplaySource } from '@/lib/discovery/format';
import { measuredNumber, type TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import type { MetricEvidence } from '@/lib/discovery/types';

const formatCompactUSD = (value: number) => `$${formatCompactUsd(value)}`;

export function TradeActivityStrip({ data }: { data: TradeSidebarSnapshot }) {
  const buy = measuredNumber(data.buyVolume5mUsd);
  const sell = measuredNumber(data.sellVolume5mUsd);
  const net = buy !== null && sell !== null ? buy - sell : null;
  const total = buy !== null && sell !== null ? buy + sell : measuredNumber(data.volume5mUsd);
  const count = (value: unknown) => measuredNumber(value) === null ? '—' : formatCount(Number(value));
  return <div className="trade-activity-strip grid grid-cols-4 gap-1 border-b border-[#1E222D] pb-2 text-[11px]" aria-label="5 minute token activity">
    {[
      { label: '5m Vol', value: total === null ? '—' : formatCompactUSD(total), color: 'text-[#F7F8F9]' },
      { label: 'Buys', value: `${count(data.buysCount5m)} / ${buy === null ? '—' : formatCompactUSD(buy)}`, color: 'text-[#2FE3AC]' },
      { label: 'Sells', value: `${count(data.sellsCount5m)} / ${sell === null ? '—' : formatCompactUSD(sell)}`, color: 'text-[#EC397A]' },
      { label: 'Net Vol.', value: net === null ? '—' : `${net >= 0 ? '+' : '-'}${formatCompactUSD(Math.abs(net))}`, color: net === null ? 'text-[#828598]' : net >= 0 ? 'text-[#2FE3AC]' : 'text-[#EC397A]' },
    ].map(item => <div key={item.label} className="min-w-0" title={`${item.label}: ${item.value}. ${data.activityEvidence ? `${formatDisplaySource(data.activityEvidence.source)}; ${data.activityEvidence.status}; observed ${data.activityEvidence.observedAt}.` : 'Activity data is pending.'}`}>
      <div className="text-[#828598]">{item.label}</div><div className={`truncate font-numeric font-medium ${item.color}`}>{item.value}</div>
    </div>)}
  </div>;
}

function getMetricColor(label: string, value: number, percent: boolean): string {
  if (label === 'LP Locked') {
    if (value >= 90) return 'text-emerald-400';
    if (value >= 50) return 'text-amber-400';
    return 'text-rose-400';
  }
  if (label === 'Top 10 H.') {
    if (value >= 60) return 'text-rose-400';
    if (value >= 35) return 'text-amber-400';
    return 'text-slate-200';
  }
  if (label === 'Dev H.') {
    if (value >= 15) return 'text-rose-400';
    if (value >= 5) return 'text-amber-400';
    return 'text-slate-200';
  }
  if (label === 'Snipers H.') {
    if (value >= 10) return 'text-rose-400';
    if (value >= 5) return 'text-amber-400';
    return 'text-slate-200';
  }
  if (label === 'Insiders') {
    if (value >= 15) return 'text-rose-400';
    if (value >= 5) return 'text-amber-400';
    return 'text-slate-200';
  }
  if (label === 'Bundlers') {
    if (value >= 15) return 'text-rose-400';
    if (value >= 5) return 'text-amber-400';
    return 'text-slate-200';
  }
  if (label === 'Pro Traders') {
    return value > 0 ? 'text-emerald-400' : 'text-slate-400';
  }
  if (label === 'Holders') {
    return 'text-slate-200';
  }
  if (percent) {
    if (value >= 25) return 'text-rose-400';
    return 'text-slate-200';
  }
  return 'text-slate-200';
}

function AuditTile({ label, value, percent = true, icon: Icon, evidence, loading, holderCount }: {
  label: string; value: unknown; percent?: boolean; icon: typeof Shield; evidence?: MetricEvidence; loading: boolean; holderCount?: number | null;
}) {
  const number = measuredNumber(value);
  const stale = evidence?.status === 'stale' || evidence?.status === 'unavailable'
    || (evidence?.expiresAt ? Date.parse(evidence.expiresAt) < Date.now() : false);
  const state = toValueState(number, { isPending: loading || evidence?.status === 'loading', isStale: stale, reason: evidence?.reason });
  return <LegendTooltip label={label} className="w-full" definition={`${label}. ${holderCount != null ? `${holderCount.toLocaleString()} classified wallets. ` : ''}${label === 'LP Locked' ? 'Measured on deepest liquidity pool; other pools may differ. ' : ''}${evidence ? `Source: ${formatDisplaySource(evidence.source)}; ${evidence.status}; observed ${evidence.observedAt}.` : 'Data is currently pending.'}`}>
    <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-[6px] border border-[#1E222D] hover:border-[#222634] px-1.5 py-2 text-[11px] bg-[#090B10] transition-colors">
      <span className="flex items-center gap-1 font-numeric text-[#F7F8F9]"><Icon className="h-3 w-3 shrink-0 text-[#828598]" />
        <MetricValue label={label} state={state} format={value => percent ? `${value.toFixed(value < 1 ? 2 : 1)}%` : formatCount(value)}
          colorize={value => getMetricColor(label, value, percent)} />
      </span><span className="text-[#828598] font-sans tracking-tight text-[10px]">{label}</span>
    </div>
  </LegendTooltip>;
}

export function TradeSidebarInfo({ data, loading, error, refresh, chain = 'solana' }: {
  data: TradeSidebarSnapshot; loading: boolean; error?: string; refresh: () => void; chain?: string;
}) {
  const [message, setMessage] = useState('');
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage('Address copied'); }
    catch { setMessage('Copy unavailable. Open the explorer to copy this address.'); }
  };
  const totalHolders = measuredNumber(data.holdersCount);
  const clampHolders = (val: unknown): number | null => {
    const num = measuredNumber(val);
    if (num === null) return null;
    if (totalHolders !== null && totalHolders >= 0) {
      return Math.min(num, totalHolders);
    }
    return num;
  };

  const address = (label: string, value: string | undefined) => <div className="flex min-w-0 items-center gap-1 rounded-[6px] border border-[#1E222D] bg-[#080A0F] px-2.5 py-1.5 font-sans">
    <span className="text-[#828598]">{label}:</span>
    {value ? <>
      <button type="button" className="min-w-0 flex-1 truncate text-left font-numeric text-[#C8C9D1] hover:text-[#F7F8F9]" title={value} aria-label={`Copy ${label} address`} onClick={() => void copy(value)}>{value.slice(0, 10)}…{value.slice(-6)}</button>
      <Link href={chain === 'robinhood' ? `https://robinhoodchain.blockscout.com/address/${value}` : `https://solscan.io/account/${value}`} target="_blank" rel="noreferrer" aria-label={`View ${label} on explorer`} className="p-1 text-[#828598] hover:text-[#8EA2FF]"><ExternalLink className="h-3 w-3" /></Link>
    </> : <span className="text-[#525866]">Unavailable</span>}
  </div>;
  return <section className="border-t border-[#1E222D] pt-2.5 text-[11px] font-sans" aria-label="Token information">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-[#F7F8F9]">Token Info</span>
      <button type="button" aria-label="Refresh token information" onClick={refresh} disabled={loading} className="p-1 rounded hover:bg-[#1C202B] text-[#828598] hover:text-[#8EA2FF] transition-colors"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-[#526FFF]' : ''}`} /></button>
    </div>
    {error && <p role="status" className="my-1 text-[#FFB224]">{error}</p>}
    <div className="my-2 grid grid-cols-3 gap-1.5 font-sans">
      <AuditTile label="Top 10 H." value={data.top10HoldingsPct} icon={Users} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Dev H." value={data.devHoldingsPct} holderCount={clampHolders(data.devCount)} icon={Wallet} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Snipers H." value={data.sniperPercentage} holderCount={clampHolders(data.sniperCount)} icon={Target} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Insiders" value={data.insiderHoldingsPct} holderCount={clampHolders(data.insiderCount)} icon={Users} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Bundlers" value={data.bundlerPercentage} holderCount={clampHolders(data.bundlerCount)} icon={Boxes} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="LP Locked" value={data.lpLockedPct} icon={Shield} evidence={data.liquidityEvidence} loading={loading} />
      <AuditTile label="Holders" value={data.holdersCount} icon={Users} percent={false}
        evidence={data.ownershipEvidence?.status === 'measured' || data.ownershipEvidence?.status === 'stale'
          ? data.ownershipEvidence : data.marketEvidence ?? data.ownershipEvidence} loading={loading} />
      <AuditTile label="Pro Traders" value={clampHolders(data.proTradersCount)} icon={Trophy} percent={false} evidence={data.ownershipEvidence} loading={loading} />
      <LegendTooltip label="Dex Paid" className="w-full" definition="Whether the project team paid DexScreener for an approved token profile order (not a temporary boost).">
        <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-[6px] border border-[#1E222D] px-1.5 py-2 text-[11px] bg-[#090B10]" title="Approved token profile order; not a boost.">
          <span className={`flex items-center gap-1 font-numeric ${data.isDexPaid === true ? 'text-[#2FE3AC]' : data.isDexPaid === false ? 'text-[#EC397A]' : 'text-[#828598]'}`}>
            <BadgeDollarSign className="h-3 w-3 shrink-0" />
            <span className="font-semibold">{typeof data.isDexPaid !== 'boolean' ? '—' : data.isDexPaid ? 'Paid' : 'Unpaid'}</span>
          </span>
          <span className="text-[#828598] font-sans tracking-tight text-[10px]">Dex Paid</span>
        </div>
      </LegendTooltip>
    </div>
    <div className="space-y-1.5">
      {address('CA', data.mint)}{address('DA', data.devAddress)}
      <div className="flex justify-between gap-2 px-1 text-slate-500"><span>Dev wallet age</span><span>{data.devWalletAge ?? 'Unavailable'}</span></div>
      <div className="flex justify-between gap-2 px-1 text-slate-500" title={data.devBalanceEvidence ? `${formatDisplaySource(data.devBalanceEvidence.source)}; ${data.devBalanceEvidence.status}; observed ${data.devBalanceEvidence.observedAt}.` : undefined}>
        <span>{chain === 'robinhood' ? 'Dev ETH balance' : 'Dev SOL balance'}</span><span className="font-numeric text-slate-300">{measuredNumber(data.devBalanceSol) === null ? 'Unavailable' : `${Number(data.devBalanceSol).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${chain === 'robinhood' ? 'ETH' : 'SOL'}`}</span>
      </div>
      <div className="flex min-w-0 justify-between gap-2 px-1 text-slate-500" title={data.fundingEvidence ? `${formatDisplaySource(data.fundingEvidence.source)}; ${data.fundingEvidence.status}; observed ${data.fundingEvidence.observedAt}.` : undefined}>
        <span>Funding wallet</span>{data.funding ? <Link href={`https://solscan.io/tx/${data.funding.signature}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-numeric text-sky-400 hover:text-sky-300" title={`${data.funding.address}; ${data.funding.amountSol} SOL; ${data.funding.fundedAt}`}>
          {data.funding.name ?? `${data.funding.address.slice(0, 5)}…${data.funding.address.slice(-4)}`} · {data.funding.amountSol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
        </Link> : <span>Unavailable</span>}
      </div>
    </div>
    <p className="sr-only" role="status">{message}</p>
    <details className="mt-3 border-t border-slate-800 pt-2">
      <summary className="cursor-pointer text-slate-300">Reused Image Tokens <span className="text-slate-500">{data.imageReuse ? data.imageReuse.matches.length : '—'}</span></summary>
      {data.imageReuse ? <div className="space-y-1 py-2 text-slate-500" title={`${formatDisplaySource(data.imageReuse.evidence.source)}; ${data.imageReuse.evidence.status}; observed ${data.imageReuse.evidence.observedAt}.`}>
        <p>{data.imageReuse.matches.length === 0 ? 'No exact image URL reuse found in Phivex’s indexed tokens.' : `Exact image URL reused by ${data.imageReuse.matches.length} indexed token${data.imageReuse.matches.length === 1 ? '' : 's'}.`}</p>
        {data.imageReuse.matches.slice(0, 5).map(match => <Link key={match.mint} href={`/trade/solana/${match.mint}`} className="block truncate text-sky-400 hover:text-sky-300" title={match.mint}>{match.symbol || match.name || match.mint}</Link>)}
      </div> : <p className="py-2 text-slate-500">Image-index result is pending or unavailable.</p>}
    </details>
  </section>;
}
