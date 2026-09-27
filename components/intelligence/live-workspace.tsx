'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Bookmark, Check, Copy, ExternalLink, RefreshCw, Search, Shield, AlertTriangle, Clock, Layers } from 'lucide-react';
import { useWatchlist } from '@/lib/store';
import { isIntelligenceMint, type IntelligenceCandidate, type IntelligenceMetric, type LiveIntelligenceReport } from '@/lib/intelligence/live-model';

const control = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-sentinel-700 bg-sentinel-900 px-3 text-xs font-medium text-slate-200 hover:bg-sentinel-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-wait disabled:opacity-60';
const panel = 'min-w-0 rounded-lg border border-sentinel-700/70 bg-sentinel-900';

function useEvidenceResource<T>(url: string | null, valid: (value: unknown) => value is T, interval = 30_000) {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const validator = useRef(valid); validator.current = valid;
  useEffect(() => {
    setData(null); setError(null);
  }, [url]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 25_000);
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        const body = await response.json();
        if (!response.ok || !body.success || !validator.current(body.data)) throw new Error(response.status === 429 ? 'Analysis is busy. Please retry shortly.' : 'Could not refresh this evidence. Please try again.');
        if (!cancelled) { setData(body.data); setError(null); }
      } catch (failure) {
        if (!cancelled) setError(controller.signal.aborted ? 'The request took too long. Please retry.' : failure instanceof Error ? failure.message : 'Evidence is temporarily unavailable.');
      } finally { clearTimeout(timeout); if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [url, revision]);
  useEffect(() => {
    if (!url || !interval) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') setRevision(value => value + 1); }, interval);
    return () => clearInterval(timer);
  }, [url, interval]);
  return { data, busy, error, refresh: () => setRevision(value => value + 1) };
}

export function formatIntelligenceValue(metric: IntelligenceMetric): string {
  if (metric.value === null) return metric.status === 'loading' ? 'Pending' : 'Not measured';
  if (typeof metric.value === 'boolean') return metric.value ? 'Yes' : 'No';
  if (metric.unit === '%') return `${metric.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  if (metric.unit === 'USD') return metric.value > 0 && metric.value < 0.001 ? `$${metric.value.toPrecision(4)}`
    : metric.value >= 10_000 ? `$${Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(metric.value)}`
      : `$${metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.value < 1 ? 6 : 2 })}`;
  return metric.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function observed(at: string | null) {
  return at ? new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No observation recorded';
}
function Metric({ metric }: { metric: IntelligenceMetric }) {
  const expired = metric.status === 'stale';
  return <div className="min-w-0 rounded-md border border-sentinel-700/50 bg-sentinel-950/50 p-3">
    <dt className="text-xs text-slate-400">{metric.label}</dt>
    <dd className={`mt-2 break-words font-mono text-base font-semibold tabular-nums ${metric.value === null ? 'text-slate-400 text-xs' : 'text-slate-100'}`}>{formatIntelligenceValue(metric)}</dd>
    <dd className={`mt-1 text-[11px] ${expired ? 'text-amber-300' : 'text-slate-400'}`} title={observed(metric.observedAt)}>{expired ? 'Stale · ' : ''}{observed(metric.observedAt)}</dd>
  </div>;
}
function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200"><span>{message}</span><button className={control} onClick={retry}>Retry</button></div>;
}
function Loading() {
  return <div role="status" className={`${panel} flex min-h-40 items-center justify-center gap-3 p-5 text-sm text-slate-400`}><RefreshCw className="h-4 w-4 motion-safe:animate-spin" />Loading measured evidence…</div>;
}

export function IntelligenceWorkspace() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const { data, busy, error, refresh } = useEvidenceResource<{ tokens: IntelligenceCandidate[] }>('/api/v1/intelligence/candidates',
    (value): value is { tokens: IntelligenceCandidate[] } => !!value && typeof value === 'object' && Array.isArray((value as { tokens?: unknown }).tokens));
  const rows = useMemo(() => (data?.tokens ?? []).filter(t => !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.symbol.toLowerCase().includes(query.toLowerCase()) || t.mint.includes(query.trim())), [data, query]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const mint = query.trim();
    if (!isIntelligenceMint(mint)) { setInputError('Select a matching token below, or paste its full Solana mint address. Symbols are not unique.'); return; }
    setInputError(null); router.push(`/intelligence/solana/${mint}`);
  };
  return <section data-active-view="intelligence" className="mx-auto w-full max-w-[1440px] space-y-5 text-xs">
    <header data-page-header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-sky-400"><Shield className="h-4 w-4" />Token research</div><h1 className="text-2xl font-semibold tracking-tight text-white">Intelligence</h1><p className="mt-2 max-w-2xl leading-relaxed text-slate-400">Inspect ownership, authorities and liquidity before your next decision. Every finding starts with recorded evidence.</p></div>
      <button className={control} onClick={refresh} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />{busy ? 'Refreshing' : 'Refresh list'}</button>
    </header>
    <div className={`${panel} p-4 sm:p-5`}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1"><label htmlFor="intelligence-search" className="mb-2 block font-medium text-slate-200">Find a token or analyze an exact mint</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input id="intelligence-search" autoComplete="off" spellCheck={false} value={query} onChange={event => { setQuery(event.target.value); setInputError(null); }} aria-describedby="intelligence-search-help" aria-invalid={!!inputError} placeholder="Search current tokens or paste a Solana mint address" className="min-h-11 w-full rounded-md border border-sentinel-700 bg-sentinel-950 py-3 pl-10 pr-3 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400" /></div></div>
        <button type="submit" className={`${control} border-sky-500/40 bg-sky-500/10 text-sky-300`}>Analyze token <ArrowRight className="h-4 w-4" /></button>
      </form>
      <p id="intelligence-search-help" className={`mt-3 text-[11px] ${inputError ? 'text-amber-300' : 'text-slate-400'}`} role={inputError ? 'alert' : undefined}>{inputError ?? 'Solana only · Exact addresses prevent symbol look-alikes · No wallet connection required'}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">{[
      ['Ownership', 'Measured concentration and holder classifications.'], ['Contract & liquidity', 'Authority checks and observed pool-lock evidence.'], ['Creator records', 'Recorded launches and migrations, without invented reputation scores.'],
    ].map(([title, text]) => <div key={title} className={`${panel} p-4`}><h2 className="font-medium text-slate-200">{title}</h2><p className="mt-2 leading-relaxed text-slate-400">{text}</p></div>)}</div>
    {error && <ErrorNotice message={data ? `${error} The previous list is retained.` : error} retry={refresh} />}
    {!data && busy ? <Loading /> : <div className={panel}>
      <div className="flex items-center justify-between gap-3 border-b border-sentinel-700/60 p-4"><h2 className="text-sm font-semibold">Current tokens</h2><span className="text-slate-400">{rows.length} matches · refreshes every 30s</span></div>
      <div className="hidden grid-cols-[minmax(0,1fr)_140px_140px_32px] gap-4 px-4 py-3 text-[11px] text-slate-400 sm:grid"><span>Token / mint</span><span className="text-right">Market cap</span><span className="text-right">Liquidity</span><span /></div>
      {rows.map(token => <Link key={token.mint} href={`/intelligence/solana/${token.mint}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_24px] items-center gap-3 border-t border-sentinel-700/40 p-4 hover:bg-sentinel-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 sm:grid-cols-[minmax(0,1fr)_140px_140px_32px] sm:gap-4" aria-label={`Analyze ${token.symbol}, mint ${token.mint}`}>
        <div className="min-w-0"><div className="flex min-w-0 items-baseline gap-2"><strong className="truncate text-sm text-white">{token.symbol}</strong><span className="truncate text-slate-400">{token.name}</span></div><span className="mt-1 block truncate font-mono text-[11px] text-slate-400">{token.mint}</span></div>
        <div className="hidden text-right font-mono tabular-nums sm:block">{formatIntelligenceValue(token.marketCap)}{token.marketCap.status === 'stale' && <span className="block text-[11px] text-amber-300">Stale</span>}</div>
        <div className="hidden text-right font-mono tabular-nums sm:block">{formatIntelligenceValue(token.liquidity)}{token.liquidity.status === 'stale' && <span className="block text-[11px] text-amber-300">Stale</span>}</div><ArrowRight className="h-4 w-4 text-sky-400" />
      </Link>)}
      {rows.length === 0 && <div className="p-8 text-center text-slate-400"><Search className="mx-auto mb-3 h-5 w-5" /><h3 className="font-medium text-slate-200">{query ? 'No current matches' : 'No current tokens received'}</h3><p className="mt-2">{query ? 'Paste the full mint address and choose Analyze token.' : 'You can still inspect a token by its exact mint address above.'}</p></div>}
    </div>}
    <p className="pb-4 text-[11px] leading-relaxed text-slate-400">Research, not a safety guarantee. Missing information never means a token is safe. Intelligence does not sign or submit transactions.</p>
  </section>;
}

export function IntelligenceReportView({ chain, mint }: { chain: string; mint: string }) {
  const validMint = chain === 'solana' && isIntelligenceMint(mint);
  const { data: storedReport, busy, error, refresh } = useEvidenceResource<LiveIntelligenceReport>(validMint ? `/api/v1/intelligence/solana/${mint}` : null,
    (value): value is LiveIntelligenceReport => !!value && typeof value === 'object' && (value as LiveIntelligenceReport).schemaVersion === '2' && (value as LiveIntelligenceReport).token?.mint === mint && Array.isArray((value as LiveIntelligenceReport).metrics));
  const report = useMemo(() => !storedReport || !error ? storedReport : { ...storedReport,
    metrics: storedReport.metrics.map(metric => metric.status === 'measured' ? { ...metric, status: 'stale' as const } : metric),
    coverage: { ...storedReport.coverage, measured: 0, stale: storedReport.coverage.stale + storedReport.coverage.measured },
  }, [storedReport, error]);
  const { isWatchlisted, toggleWatchlist, error: watchlistError } = useWatchlist();
  const [watchlistAttempted, setWatchlistAttempted] = useState(false);
  const watched = isWatchlisted(mint);
  const [copyState, setCopyState] = useState('Copy mint');
  const [showHistory, setShowHistory] = useState(false);
  const history = useEvidenceResource<{ status: string; observations: { category: string; observedAt: string }[] }>(showHistory && validMint ? `/api/v1/intelligence/solana/${mint}/history` : null,
    (value): value is { status: string; observations: { category: string; observedAt: string }[] } => !!value && typeof value === 'object' && Array.isArray((value as { observations?: unknown }).observations), 0);
  const copy = async () => { try { await navigator.clipboard.writeText(mint); setCopyState('Copied'); } catch { setCopyState('Copy failed'); } };
  if (!validMint) return <section className="mx-auto max-w-3xl space-y-4"><Link href="/intelligence" className={`${control} w-fit`}><ArrowLeft className="h-4 w-4" />Intelligence</Link><div className={`${panel} p-6`}><h1 className="text-lg font-semibold">An exact Solana mint is required</h1><p className="mt-2 text-sm text-slate-400">Symbol-only reports have been retired. Search Intelligence to select the correct token.</p></div></section>;
  return <section data-active-view="intelligence" className="mx-auto w-full max-w-[1440px] space-y-5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/intelligence" className={`${control} w-fit`}><ArrowLeft className="h-4 w-4" />Intelligence</Link><button className={control} onClick={refresh} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />{busy ? 'Refreshing evidence' : 'Refresh evidence'}</button></div>
    <header data-intelligence-header className={`${panel} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><span className="text-[11px] uppercase tracking-widest text-sky-400">Solana · Evidence report</span><h1 className="mt-2 break-words text-2xl font-semibold text-white">{report?.token.symbol ?? 'Token intelligence'} <span className="text-base font-normal text-slate-400">{report?.token.name}</span></h1><p className="mt-2 break-all font-mono text-[11px] text-slate-400">{mint}</p></div><div className="flex flex-wrap gap-2"><button className={control} onClick={copy}>{copyState === 'Copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}<span aria-live="polite">{copyState}</span></button><button className={control} aria-pressed={watched} onClick={() => { setWatchlistAttempted(true); toggleWatchlist(mint); }}><Bookmark className={`h-4 w-4 ${watched ? 'fill-sky-400 text-sky-400' : ''}`} />{watched ? 'Watchlisted' : 'Watchlist'}</button><Link className={`${control} border-sky-500/40 bg-sky-500/10 text-sky-300`} href={`/trade/solana/${mint}`}>Open Trade <ArrowRight className="h-4 w-4" /></Link></div></div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-sentinel-700/50 pt-3 text-[11px] text-slate-400"><span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{report ? `Refreshed ${observed(report.generatedAt)}` : 'Waiting for observations'}</span><span>Auto-refresh · 30s</span><a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 text-sky-400 hover:text-sky-300">Token explorer <ExternalLink className="h-3 w-3" /></a></div>
    </header>
    {watchlistAttempted && watchlistError && <p role="alert" className="rounded-md border border-amber-500/30 p-3 text-amber-200">Your watchlist could not be updated. Check your connection and try the Watchlist button again.</p>}
    {error && <ErrorNotice message={report ? `${error} Earlier observations remain visible; check their timestamps.` : error} retry={refresh} />}
    {!report && busy && <Loading />}
    {report && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><dl className="contents">{report.metrics.filter(m => m.category === 'market').map(m => <Metric key={m.id} metric={m} />)}</dl></div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">{([
          ['ownership', 'Ownership', 'Holdings as a share of supply. Classifications can be incomplete or heuristic.'],
          ['security', 'Authorities & liquidity', 'Authority revocation and liquidity locks describe different risks. A lock alone does not make a token safe.'],
          ['creator', 'Creator records', 'Recorded launch history, not an assessment of identity or intent.'],
        ] as const).map(([category, title, description]) => <section key={category} className={`${panel} p-4`}><h2 className="text-sm font-semibold text-white">{title}</h2><p className="mb-4 mt-1 leading-relaxed text-slate-400">{description}</p><dl className="grid grid-cols-2 gap-3 md:grid-cols-3">{report.metrics.filter(m => m.category === category).map(m => <Metric key={m.id} metric={m} />)}</dl>{category === 'creator' && report.token.creator && <a className="mt-4 inline-flex max-w-full items-center gap-2 text-sky-400" href={`https://solscan.io/account/${report.token.creator}`} target="_blank" rel="noopener noreferrer"><span className="truncate font-mono">Creator: {report.token.creator}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>}</section>)}</div>
        <aside className="min-w-0 space-y-4">
          <section className={`${panel} p-4`}><h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-sky-400" />Evidence coverage</h2><p className="mt-3 font-mono text-2xl text-white">{report.coverage.measured}<span className="text-base text-slate-400"> / {report.coverage.total} current</span></p><p className="mt-2 leading-relaxed text-slate-400">{report.coverage.stale} stale · {report.coverage.pending} pending · {report.coverage.total - report.coverage.measured - report.coverage.stale - report.coverage.pending} not measured</p><p className="mt-3 border-t border-sentinel-700/50 pt-3 leading-relaxed text-slate-400">Coverage measures available evidence, not safety or confidence.</p></section>
          <section className={`${panel} p-4`}><h2 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-300" />Review findings</h2><div className="mt-4 space-y-4">{report.findings.length ? report.findings.map(finding => <div key={finding.id} className="border-l-2 border-amber-400/50 pl-3"><h3 className="font-semibold text-amber-200">{finding.title}</h3><p className="mt-1 leading-relaxed text-slate-400">{finding.description}</p><div className="mt-2 space-y-1">{finding.evidenceIds.map(id => { const metric = report.metrics.find(m => m.id === id)!; return <p key={id} className="text-[11px] text-slate-300">{metric.label}: {formatIntelligenceValue(metric)}{metric.status === 'stale' ? ' · Stale observation' : ''}</p>; })}</div></div>) : <p className="leading-relaxed text-slate-400">No review thresholds were triggered by the available evidence. This is not a safety assessment; review missing and stale fields.</p>}</div></section>
          {report.lifecycle.state && <section className={`${panel} p-4`}><h2 className="text-sm font-semibold">Lifecycle observation</h2><p className="mt-2 capitalize text-slate-300">{report.lifecycle.state.replace(/_/g, ' ')}</p><p className="mt-1 text-[11px] text-slate-400">{observed(report.lifecycle.observedAt)}</p>{report.lifecycle.signature && <a className="mt-3 inline-flex min-h-11 items-center gap-2 text-sky-400" href={`https://solscan.io/tx/${report.lifecycle.signature}`} target="_blank" rel="noopener noreferrer">Migration proof <ExternalLink className="h-3 w-3" /></a>}</section>}
        </aside>
      </div>
      <section className={`${panel} p-4`}><h2 className="text-sm font-semibold">Recorded observation log</h2><p className="mt-1 text-slate-400">Saved audit observations for this mint. An observation is not necessarily a change or a transaction.</p><button className={`${control} mt-3`} onClick={() => { if (showHistory) history.refresh(); else setShowHistory(true); }} disabled={history.busy}>{history.busy ? 'Loading observations' : showHistory ? 'Refresh observations' : 'Load observations'}</button>{history.error && <p role="alert" className="mt-3 text-amber-300">{history.error}</p>}{history.data && <div className="mt-4">{history.data.observations.length ? <ol className="divide-y divide-sentinel-700/40">{history.data.observations.map((item, index) => <li key={`${item.category}-${item.observedAt}-${index}`} className="flex flex-wrap justify-between gap-2 py-2"><span className="capitalize text-slate-300">{item.category} observed</span><time className="font-mono text-[11px] text-slate-400" dateTime={item.observedAt}>{observed(item.observedAt)}</time></li>)}</ol> : <p className="text-slate-400">{history.data.status === 'unavailable' ? 'Saved history is temporarily unavailable.' : 'No saved observations yet. A historical change cannot be established.'}</p>}</div>}</section>
      <details className={`${panel} p-4`}><summary className="min-h-8 cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">Methodology & limitations</summary><ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-slate-400">{report.limitations.map(text => <li key={text}>{text}</li>)}</ul><p className="mt-4 text-[11px] text-slate-400">Methodology: {report.methodologyVersion}. Review thresholds: top ten ≥35%, developer ≥5%, liquidity &lt;$10,000. These are explicit review rules, not probabilities. Reports do not authorize or execute trades.</p></details>
    </>}
  </section>;
}
