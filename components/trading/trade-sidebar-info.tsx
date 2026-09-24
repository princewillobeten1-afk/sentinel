'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Users, Shield, Target, Boxes, Wallet, Trophy, BadgeDollarSign } from 'lucide-react';
import { MetricValue } from '@/components/ui/metric-value';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { toValueState } from '@/lib/ui/value-state';
import { formatCompactUsd, formatCount } from '@/lib/discovery/format';
import { measuredNumber, type TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import type { MetricEvidence } from '@/lib/discovery/types';

const formatCompactUSD = (value: number) => `$${formatCompactUsd(value)}`;

export function TradeActivityStrip({ data }: { data: TradeSidebarSnapshot }) {
  const buy = measuredNumber(data.buyVolume5mUsd);
  const sell = measuredNumber(data.sellVolume5mUsd);
  const net = buy !== null && sell !== null ? buy - sell : null;
  const total = buy !== null && sell !== null ? buy + sell : measuredNumber(data.volume5mUsd);
  const count = (value: unknown) => measuredNumber(value) === null ? '—' : formatCount(Number(value));
  return <div className="trade-activity-strip grid grid-cols-4 gap-1 border-b border-slate-800 pb-2 text-[11px]" aria-label="5 minute token activity">
    {[
      { label: '5m Vol', value: total === null ? '—' : formatCompactUSD(total), color: 'text-slate-200' },
      { label: 'Buys', value: `${count(data.buysCount5m)} / ${buy === null ? '—' : formatCompactUSD(buy)}`, color: 'text-emerald-400' },
      { label: 'Sells', value: `${count(data.sellsCount5m)} / ${sell === null ? '—' : formatCompactUSD(sell)}`, color: 'text-rose-400' },
      { label: 'Net Vol.', value: net === null ? '—' : `${net >= 0 ? '+' : '-'}${formatCompactUSD(Math.abs(net))}`, color: net === null ? 'text-slate-400' : net >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    ].map(item => <div key={item.label} className="min-w-0" title={`${item.label}: ${item.value}. ${data.activityEvidence ? `${data.activityEvidence.source}; ${data.activityEvidence.status}; observed ${data.activityEvidence.observedAt}. ${data.activityEvidence.reason ?? ''}` : 'No provider evidence is available.'}`}>
      <div className="text-slate-500">{item.label}</div><div className={`truncate font-numeric ${item.color}`}>{item.value}</div>
    </div>)}
  </div>;
}

function AuditTile({ label, value, percent = true, icon: Icon, evidence, loading }: {
  label: string; value: unknown; percent?: boolean; icon: typeof Shield; evidence?: MetricEvidence; loading: boolean;
}) {
  const number = measuredNumber(value);
  const stale = evidence?.status === 'stale' || evidence?.status === 'unavailable'
    || (evidence?.expiresAt ? Date.parse(evidence.expiresAt) < Date.now() : false);
  const state = toValueState(number, { isPending: loading || evidence?.status === 'loading', isStale: stale, reason: evidence?.reason });
  return <LegendTooltip label={label} className="w-full" definition={`${label}. ${label === 'LP Locked' ? 'Measured on Rugcheck’s deepest reported pool only; other pools may differ. ' : ''}${evidence ? `Source: ${evidence.source}; ${evidence.status}; observed ${evidence.observedAt}. ${evidence.reason ?? ''}` : 'Unavailable until a provider reports this metric.'}`}>
    <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded border border-slate-800 px-1 py-2 text-[11px]">
      <span className="flex items-center gap-1 font-numeric text-slate-200"><Icon className="h-3 w-3 shrink-0" />
        <MetricValue label={label} state={state} format={value => percent ? `${value.toFixed(value < 1 ? 2 : 1)}%` : formatCount(value)}
          colorize={value => percent && label !== 'LP Locked' && value >= 20 ? 'text-rose-400' : 'text-slate-200'} />
      </span><span className="text-slate-500">{label}</span>
    </div>
  </LegendTooltip>;
}

export function TradeSidebarInfo({ data, loading, error, refresh }: {
  data: TradeSidebarSnapshot; loading: boolean; error?: string; refresh: () => void;
}) {
  const [message, setMessage] = useState('');
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage('Address copied'); }
    catch { setMessage('Copy unavailable. Open the explorer to copy this address.'); }
  };
  const address = (label: string, value: string | undefined) => <div className="flex min-w-0 items-center gap-1 rounded border border-slate-800 px-2 py-1.5">
    <span className="text-slate-500">{label}:</span>
    {value ? <>
      <button type="button" className="min-w-0 flex-1 truncate text-left font-numeric text-slate-300" title={value} aria-label={`Copy ${label} address`} onClick={() => void copy(value)}>{value.slice(0, 10)}…{value.slice(-6)}</button>
      <Link href={`https://solscan.io/account/${value}`} target="_blank" rel="noreferrer" aria-label={`View ${label} on Solscan`} className="p-1 text-slate-400 hover:text-sky-400"><ExternalLink className="h-3 w-3" /></Link>
    </> : <span className="text-slate-500">Unavailable</span>}
  </div>;
  return <section className="border-t border-slate-800 pt-2 text-[11px]" aria-label="Token information">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-slate-200">Token Info</span>
      <button type="button" aria-label="Refresh token information" onClick={refresh} disabled={loading} className="p-1 text-slate-400 hover:text-sky-400"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /></button>
    </div>
    {error && <p role="status" className="my-1 text-amber-400">{error}</p>}
    <div className="my-2 grid grid-cols-3 gap-1.5">
      <AuditTile label="Top 10 H." value={data.top10HoldingsPct} icon={Users} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Dev H." value={data.devHoldingsPct} icon={Wallet} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Snipers H." value={data.sniperPercentage} icon={Target} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Insiders" value={data.insiderHoldingsPct} icon={Users} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="Bundlers" value={data.bundlerPercentage} icon={Boxes} evidence={data.ownershipEvidence} loading={loading} />
      <AuditTile label="LP Locked" value={data.lpLockedPct} icon={Shield} evidence={data.liquidityEvidence} loading={loading} />
      <AuditTile label="Holders" value={data.holdersCount} icon={Users} percent={false}
        evidence={data.ownershipEvidence?.status === 'measured' || data.ownershipEvidence?.status === 'stale'
          ? data.ownershipEvidence : data.marketEvidence ?? data.ownershipEvidence} loading={loading} />
      <AuditTile label="Pro Traders" value={data.proTradersCount} icon={Trophy} percent={false} evidence={data.ownershipEvidence} loading={loading} />
      <div className="flex flex-col items-center justify-center gap-1 rounded border border-slate-800 p-1" title="Approved DexScreener profile order; not a boost.">
        <span className={`flex items-center gap-1 ${data.isDexPaid === true ? 'text-emerald-400' : data.isDexPaid === false ? 'text-rose-400' : 'text-slate-500'}`}><BadgeDollarSign className="h-3 w-3" />{typeof data.isDexPaid !== 'boolean' ? '—' : data.isDexPaid ? 'Paid' : 'Unpaid'}</span>
        <span className="text-slate-500">Dex Paid</span>
      </div>
    </div>
    <div className="space-y-1.5">
      {address('CA', data.mint)}{address('DA', data.devAddress)}
      <div className="flex justify-between gap-2 px-1 text-slate-500"><span>Dev wallet age</span><span>{data.devWalletAge ?? 'Unavailable'}</span></div>
      <div className="flex justify-between gap-2 px-1 text-slate-500" title={data.devBalanceEvidence ? `${data.devBalanceEvidence.source}; ${data.devBalanceEvidence.status}; observed ${data.devBalanceEvidence.observedAt}. ${data.devBalanceEvidence.reason ?? ''}` : undefined}>
        <span>Dev SOL balance</span><span className="font-numeric text-slate-300">{measuredNumber(data.devBalanceSol) === null ? 'Unavailable' : `${Number(data.devBalanceSol).toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`}</span>
      </div>
      <div className="flex min-w-0 justify-between gap-2 px-1 text-slate-500" title={data.fundingEvidence ? `${data.fundingEvidence.source}; ${data.fundingEvidence.status}; observed ${data.fundingEvidence.observedAt}. ${data.fundingEvidence.reason ?? ''}` : undefined}>
        <span>Funding wallet</span>{data.funding ? <Link href={`https://solscan.io/tx/${data.funding.signature}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-numeric text-sky-400 hover:text-sky-300" title={`${data.funding.address}; ${data.funding.amountSol} SOL; ${data.funding.fundedAt}`}>
          {data.funding.name ?? `${data.funding.address.slice(0, 5)}…${data.funding.address.slice(-4)}`} · {data.funding.amountSol.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL
        </Link> : <span>Unavailable</span>}
      </div>
    </div>
    <p className="sr-only" role="status">{message}</p>
    <details className="mt-3 border-t border-slate-800 pt-2">
      <summary className="cursor-pointer text-slate-300">Reused Image Tokens <span className="text-slate-500">{data.imageReuse ? data.imageReuse.matches.length : '—'}</span></summary>
      {data.imageReuse ? <div className="space-y-1 py-2 text-slate-500" title={`${data.imageReuse.evidence.source}; ${data.imageReuse.evidence.status}; observed ${data.imageReuse.evidence.observedAt}. ${data.imageReuse.evidence.reason ?? ''}`}>
        <p>{data.imageReuse.matches.length === 0 ? 'No exact image URL reuse found in Sentinel’s indexed tokens.' : `Exact image URL reused by ${data.imageReuse.matches.length} indexed token${data.imageReuse.matches.length === 1 ? '' : 's'}.`}</p>
        {data.imageReuse.matches.slice(0, 5).map(match => <Link key={match.mint} href={`/trade/solana/${match.mint}`} className="block truncate text-sky-400 hover:text-sky-300" title={match.mint}>{match.symbol || match.name || match.mint}</Link>)}
      </div> : <p className="py-2 text-slate-500">Image-index result is pending or unavailable.</p>}
    </details>
  </section>;
}
