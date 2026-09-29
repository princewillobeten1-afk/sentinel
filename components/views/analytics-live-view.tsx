'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Clock3, FlaskConical, RefreshCw } from 'lucide-react';
import { Panel } from '@/components/ui/panel';

interface MarketMover {
  mint: string;
  symbol: string | null;
  name: string | null;
  change24hPct: number;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  observedAt: string | null;
}

interface MarketSnapshot {
  timeframe: '24h';
  volumeDecomposition: {
    totalVolumeUsd: number | null;
    buyVolumeUsd: number | null;
    sellVolumeUsd: number | null;
    organicVolumeUsd: number | null;
    organicEligibleVolumeUsd: number | null;
    organicVolumePct: number | null;
  };
  coverage: {
    tokenCount: number;
    totalLiquidityUsd: number | null;
    updatedAt: string | null;
    organicCoverageTokens: number;
    moverThresholds: { minimumLiquidityUsd: number; minimumVolume24hUsd: number };
  };
  breadth: { advancing: number; declining: number; unchanged: number; unknown: number };
  movers: { gainers: MarketMover[]; decliners: MarketMover[] };
}

const money = (value: number | null | undefined) => value === null || value === undefined
  ? '—' : `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number | null | undefined) => value === null || value === undefined
  ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
const observed = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Observation time unavailable';

function SummaryCard({ label, value, detail, tone = 'text-slate-100' }: {
  label: string; value: string; detail: string; tone?: string;
}) {
  return <div className="min-w-0 rounded-md border border-slate-800 bg-slate-900/70 px-4 py-3">
    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className={`mt-1 truncate font-mono text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
  </div>;
}

function MoverChart({ gainers, decliners }: { gainers: MarketMover[]; decliners: MarketMover[] }) {
  const rows = [...gainers, ...decliners];
  if (rows.length === 0) return <p className="rounded-md border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
    No liquid tokens with measured 24h changes are available yet.
  </p>;
  const maxMove = Math.max(...rows.map(row => Math.abs(row.change24hPct)), 1);
  return <div role="group" aria-label="Bar chart of 24-hour token price increases and decreases" className="space-y-2">
    <div className="grid grid-cols-[minmax(70px,112px)_minmax(0,1fr)_68px] items-center gap-2 text-[11px] text-slate-400 sm:gap-3">
      <span>Token</span><div className="flex justify-between"><span>Decrease</span><span>Increase</span></div><span className="text-right">24h</span>
    </div>
    {rows.map(row => {
      const rising = row.change24hPct > 0;
      // Newly launched tokens can move thousands of percent in a day. A signed
      // log scale keeps ordinary declines visible without clipping large gains.
      const width = `${Math.log1p(Math.abs(row.change24hPct)) / Math.log1p(maxMove) * 50}%`;
      return <div key={row.mint} className="grid grid-cols-[minmax(70px,112px)_minmax(0,1fr)_68px] items-center gap-2 sm:gap-3">
        <Link href={`/trade/solana/${encodeURIComponent(row.mint)}`} className="truncate text-xs font-semibold text-slate-200 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400" title={`${row.name || row.symbol || row.mint} · ${row.mint}`}>
          {row.symbol || row.name || `${row.mint.slice(0, 5)}…`}
        </Link>
        <div className="relative h-5 rounded-sm bg-slate-950/70" title={`${row.symbol || row.mint}: ${percent(row.change24hPct)}; observed ${observed(row.observedAt)}`}>
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-slate-600" />
          <span aria-hidden="true" className={`absolute inset-y-1 rounded-sm ${rising ? 'left-1/2 bg-emerald-400/80' : 'right-1/2 bg-rose-400/80'}`} style={{ width }} />
        </div>
        <span className={`text-right font-mono text-xs font-medium tabular-nums ${rising ? 'text-emerald-400' : 'text-rose-400'}`}>{percent(row.change24hPct)}</span>
      </div>;
    })}
    <p className="pt-1 text-[11px] text-slate-400">Bar lengths share a signed logarithmic scale so large new-token gains do not hide declines. Exact 24h changes are shown at right.</p>
  </div>;
}

function BreadthChart({ breadth }: { breadth: MarketSnapshot['breadth'] }) {
  const measured = breadth.advancing + breadth.declining + breadth.unchanged;
  if (measured === 0) return <p className="text-xs text-slate-400">Price direction has not been measured for tracked tokens.</p>;
  const groups = [
    { label: 'Advancing', value: breadth.advancing, color: 'bg-emerald-400', text: 'text-emerald-400' },
    { label: 'Declining', value: breadth.declining, color: 'bg-rose-400', text: 'text-rose-400' },
    { label: 'Unchanged', value: breadth.unchanged, color: 'bg-slate-500', text: 'text-slate-300' },
  ];
  return <div>
    <div role="img" aria-label={`${breadth.advancing} advancing, ${breadth.declining} declining, ${breadth.unchanged} unchanged tokens`} className="flex h-4 overflow-hidden rounded-sm bg-slate-950">
      {groups.map(group => group.value > 0 ? <span key={group.label} className={group.color} style={{ width: `${group.value / measured * 100}%` }} /> : null)}
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      {groups.map(group => <div key={group.label} className="min-w-0">
        <p className={`font-mono text-lg font-semibold tabular-nums ${group.text}`}>{count(group.value)}</p>
        <p className="text-[11px] text-slate-400">{group.label}</p>
      </div>)}
    </div>
    {breadth.unknown > 0 && <p className="mt-3 text-[11px] text-slate-400">{count(breadth.unknown)} tracked tokens have no measured 24h direction and are excluded from the bar.</p>}
  </div>;
}

function VolumeChart({ volume }: { volume: MarketSnapshot['volumeDecomposition'] }) {
  const buy = volume.buyVolumeUsd;
  const sell = volume.sellVolumeUsd;
  const directional = buy !== null && sell !== null ? buy + sell : null;
  const inconsistentTotals = directional !== null && volume.totalVolumeUsd !== null
    && volume.totalVolumeUsd > 0 && directional > volume.totalVolumeUsd * 1.05;
  return <div className="space-y-4">
    {directional !== null && directional > 0 ? <>
      <div role="img" aria-label={`Recorded buy volume ${money(buy)}, sell volume ${money(sell)}`} className="flex h-4 overflow-hidden rounded-sm bg-slate-950">
        <span className="bg-emerald-400" style={{ width: `${buy! / directional * 100}%` }} />
        <span className="bg-rose-400" style={{ width: `${sell! / directional * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-slate-400">Buys</span><strong className="block font-mono text-base text-emerald-400">{money(buy)}</strong></div>
        <div><span className="text-slate-400">Sells</span><strong className="block font-mono text-base text-rose-400">{money(sell)}</strong></div>
      </div>
      <p className="text-[11px] text-slate-400">Split of recorded directional volume; coverage can differ from total volume.</p>
      {inconsistentTotals && <p className="text-[11px] text-amber-400">Buy and sell totals exceed reported volume, so compare their direction only—not their sum.</p>}
    </> : <p className="text-xs text-slate-400">Directional volume is not available for this snapshot.</p>}
    <div className="border-t border-slate-800 pt-3 text-xs">
      <div className="flex justify-between gap-3"><span className="text-slate-400">Organic volume</span><span className="font-mono text-slate-200">{money(volume.organicVolumeUsd)}</span></div>
      <div className="mt-1 flex justify-between gap-3"><span className="text-slate-400">Share of covered volume</span><span className="font-mono text-slate-200">{volume.organicVolumePct === null ? '—' : `${volume.organicVolumePct.toFixed(1)}%`}</span></div>
    </div>
  </div>;
}

export function AnalyticsLiveView({ onOpenLab }: { onOpenLab: () => void }) {
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch('/api/v1/analytics/market?timeframe=24h', { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok || !body?.coverage || !body?.movers || !body?.breadth) throw new Error('Market analytics are temporarily unavailable.');
        if (!controller.signal.aborted) { setData(body as MarketSnapshot); setError(null); }
      } catch {
        if (!controller.signal.aborted) setError('Market analytics could not be refreshed. Previous observations remain visible.');
      } finally {
        busy = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [revision]);

  const tokenCount = data?.coverage.tokenCount ?? 0;
  const measured = data !== null && tokenCount > 0;
  const lastAt = data?.coverage.updatedAt;
  const delayed = Boolean(lastAt && Date.now() - Date.parse(lastAt) > 10 * 60_000);
  const volume = data?.volumeDecomposition;
  const breadth = data?.breadth;
  const direction = breadth ? breadth.advancing - breadth.declining : 0;
  const breadthMeasured = Boolean(breadth && breadth.advancing + breadth.declining + breadth.unchanged > 0);

  return <div className="space-y-4 pb-8">
    <div data-page-header className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-sky-400" /><h1 className="text-xl font-semibold tracking-tight text-slate-100">Market analytics</h1></div>
        <p className="mt-1 text-xs text-slate-400">Measured 24h market snapshot across tracked Solana tokens.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-1 text-[11px] ${delayed ? 'border-amber-800 text-amber-300' : 'border-slate-700 text-slate-300'}`}>
          <Clock3 className="mr-1 inline h-3 w-3" />{data ? `${delayed ? 'Delayed' : 'Latest'} · ${observed(lastAt)}` : 'Awaiting snapshot'}
        </span>
        <button type="button" onClick={() => { setLoading(true); setRevision(value => value + 1); }} disabled={loading}
          className="min-h-10 rounded-md border border-slate-700 px-3 text-xs text-slate-200 hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50" aria-label="Refresh market analytics">
          <RefreshCw className={`mr-1 inline h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`} />Refresh
        </button>
        <button type="button" onClick={onOpenLab} className="min-h-10 rounded-md border border-slate-700 px-3 text-xs text-slate-300 hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
          <FlaskConical className="mr-1 inline h-3.5 w-3.5" />Research workspace
        </button>
      </div>
    </div>

    {error && <p role="alert" className="rounded-md border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">{error}</p>}
    {!data && loading ? <div role="status" className="rounded-md border border-slate-800 p-12 text-center text-xs text-slate-400">Loading measured analytics…</div>
      : !measured ? <div role="status" className="rounded-md border border-dashed border-slate-700 p-12 text-center text-sm text-slate-400">No measured token snapshot is available yet. Analytics will appear as the market feed populates.</div>
      : <>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tracked 24h volume" value={money(volume?.totalVolumeUsd)} detail="Sum across priced tokens" />
          <SummaryCard label="Tracked liquidity" value={money(data.coverage.totalLiquidityUsd)} detail="Sum of reported pool liquidity" />
          <SummaryCard label="Priced tokens" value={count(tokenCount)} detail="Current aggregate coverage" />
          <SummaryCard label="Market breadth" value={!breadthMeasured ? '—' : direction > 0 ? `+${count(direction)}` : count(direction)}
            detail="Advancing minus declining tokens" tone={direction > 0 ? 'text-emerald-400' : direction < 0 ? 'text-rose-400' : 'text-slate-100'} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <Panel title={<><Activity className="h-4 w-4 text-sky-400" />24h price movers</>} subtitle="Increase and decrease on one scale; click a token to inspect its trade view." padding="md">
            <MoverChart gainers={data.movers.gainers} decliners={data.movers.decliners} />
          </Panel>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Panel title={<><ArrowUpRight className="h-4 w-4 text-emerald-400" />Market breadth</>} subtitle="Direction among tokens with a measured 24h change." padding="md">
              <BreadthChart breadth={data.breadth} />
            </Panel>
            <Panel title={<><ArrowDownRight className="h-4 w-4 text-rose-400" />Volume flow</>} subtitle="Directional and organic portions of the tracked 24h volume." padding="md">
              <VolumeChart volume={data.volumeDecomposition} />
            </Panel>
          </div>
        </div>

        <Panel title="How to read this snapshot" padding="md">
          <div className="grid gap-3 text-xs text-slate-400 md:grid-cols-3">
            <p><span className="block font-semibold text-slate-200">Scope</span>This covers {count(tokenCount)} priced tokens in Sentinel’s store, not every Solana token. Organic flow is reported for {count(data.coverage.organicCoverageTokens)} of them.</p>
            <p><span className="block font-semibold text-slate-200">Mover selection</span>Bars include tokens with at least {money(data.coverage.moverThresholds.minimumLiquidityUsd)} liquidity and {money(data.coverage.moverThresholds.minimumVolume24hUsd)} 24h volume.</p>
            <p><span className="block font-semibold text-slate-200">Freshness</span>The latest aggregate observation was {observed(lastAt)}. Individual mover timestamps may differ; hover a bar for its observation.</p>
          </div>
        </Panel>
      </>}
  </div>;
}
