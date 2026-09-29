'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Clock3, RefreshCw } from 'lucide-react';

type Section = 'market' | 'volume' | 'exit' | 'wallets' | 'trader' | 'rankings' | 'backtest';
type Ranking = 'volume' | 'gainers' | 'decliners' | 'liquidity';
type Token = { mint: string; symbol: string | null; name: string | null; change24hPct: number | null;
  priceUsd: number | null; volume24hUsd: number | null; liquidityUsd: number | null;
  organicVolume24hUsd: number | null; holderCount: number | null; poolAddress: string | null;
  observedAt: string | null };
type Research = { sort: Ranking; selectedMint: string | null; ranked: Token[]; token: Token | null;
  observedWallets: { address: string; buys: number; sells: number; provisional: number; lastSeen: string }[] };
type Market = { breadth: { advancing: number; declining: number; unchanged: number; unknown: number };
  coverage: { tokenCount: number; totalLiquidityUsd: number | null; updatedAt: string | null; organicCoverageTokens: number };
  volumeDecomposition: { totalVolumeUsd: number | null; buyVolumeUsd: number | null; sellVolumeUsd: number | null;
    organicVolumeUsd: number | null; organicEligibleVolumeUsd: number | null; organicVolumePct: number | null } };
type Order = { id: string; tokenSymbol: string | null; side: string; status: string; filledQuantity: string | number | null; timestamp: string };
type Result = { mint: string; freshness: string; result: { status: 'measured' | 'insufficient'; bars: number; closedTrades?: number;
  winRatePct?: number | null; compoundedReturnPct?: number | null; maxClosedTradeDrawdownPct?: number | null;
  trades: { entryTime: number; exitTime: number; netReturnPct: number }[] } };

const sections: { id: Section; label: string }[] = [
  { id: 'market', label: 'Market breadth' }, { id: 'volume', label: 'Volume quality' },
  { id: 'exit', label: 'Exit capacity' }, { id: 'wallets', label: 'Wallet activity' },
  { id: 'trader', label: 'My orders' }, { id: 'rankings', label: 'Token rankings' },
  { id: 'backtest', label: 'Backtest' },
];
const rankings: { id: Ranking; label: string }[] = [
  { id: 'volume', label: 'Volume' }, { id: 'gainers', label: 'Gainers' },
  { id: 'decliners', label: 'Decliners' }, { id: 'liquidity', label: 'Liquidity' },
];
const fmt = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—'
  : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(v);
const usd = (v: number | null | undefined) => v == null ? '—' : `$${fmt(v)}`;
const pct = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const when = (v: string | null | undefined) => v && Number.isFinite(Date.parse(v))
  ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not observed';
const shorten = (v: string) => `${v.slice(0, 5)}…${v.slice(-5)}`;

function Panel({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-md border border-slate-800 bg-slate-900/55">
    <header className="border-b border-slate-800 px-4 py-3"><h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {detail && <p className="mt-0.5 text-xs text-slate-400">{detail}</p>}</header>
    <div className="p-4">{children}</div>
  </section>;
}
function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0 rounded-md border border-slate-800 bg-slate-950/50 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 truncate font-mono text-xl font-semibold tabular-nums text-slate-100">{value}</p>
    {detail && <p className="mt-1 text-[11px] text-slate-400">{detail}</p>}</div>;
}
function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-3 text-xs leading-5 text-slate-300">{children}</p>;
}
function Split({ a, b, aName, bName }: { a: number; b: number; aName: string; bName: string }) {
  const sum = a + b;
  return <div><div role="img" aria-label={`${aName} ${fmt(a)}, ${bName} ${fmt(b)}`} className="flex h-3 overflow-hidden rounded-sm bg-slate-800">
    {sum > 0 && <><span className="bg-emerald-400" style={{ width: `${a / sum * 100}%` }} />
      <span className="bg-rose-400" style={{ width: `${b / sum * 100}%` }} /></>}
  </div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>{aName} {fmt(a)}</span><span>{bName} {fmt(b)}</span></div></div>;
}

export function AnalyticsResearchView({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section>('market');
  const [ranking, setRanking] = useState<Ranking>('volume');
  const [mint, setMint] = useState<string | null>(null);
  const [mintInput, setMintInput] = useState('');
  const [market, setMarket] = useState<Market | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [marketError, setMarketError] = useState(false);
  const [researchError, setResearchError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [size, setSize] = useState(1000);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersState, setOrdersState] = useState<'loading' | 'auth' | 'ready' | 'error'>('loading');
  const [interval, setInterval] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const [cost, setCost] = useState(0.3);
  const [backtest, setBacktest] = useState<Result | null>(null);
  const [backtestState, setBacktestState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/v1/analytics/market?timeframe=24h', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        const value = await response.json();
        if (!controller.signal.aborted) { setMarket(value); setMarketError(false); }
      } catch { if (!controller.signal.aborted) setMarketError(true); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({ sort: ranking });
        if (mint) params.set('mint', mint);
        const response = await fetch(`/api/v1/analytics/research?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        const value = await response.json() as Research;
        if (!controller.signal.aborted) {
          setResearch(value); setResearchError(false);
          if (!mint && value.ranked[0]) { setMint(value.ranked[0].mint); setMintInput(value.ranked[0].mint); }
        }
      } catch { if (!controller.signal.aborted) setResearchError(true); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [ranking, mint, revision]);

  useEffect(() => {
    if (section !== 'trader') return;
    const controller = new AbortController();
    const load = async () => {
      setOrdersState('loading');
      try {
        const response = await fetch('/api/v1/trading/history?limit=100', { signal: controller.signal, cache: 'no-store' });
        if (response.status === 401) { if (!controller.signal.aborted) setOrdersState('auth'); return; }
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (!Array.isArray(body?.data?.trades)) throw new Error();
        if (!controller.signal.aborted) { setOrders(body.data.trades); setOrdersState('ready'); }
      } catch { if (!controller.signal.aborted) setOrdersState('error'); }
    };
    void load();
    return () => controller.abort();
  }, [section, revision]);

  const token = research?.token?.mint === mint ? research.token
    : research?.ranked.find(item => item.mint === mint) ?? null;
  const visibleBacktest = backtest?.mint === mint ? backtest : null;
  const breadth = market?.breadth;
  const flow = market?.volumeDecomposition;
  const measured = breadth ? breadth.advancing + breadth.declining + breadth.unchanged : 0;
  const delayed = market?.coverage.updatedAt ? Date.now() - Date.parse(market.coverage.updatedAt) > 600_000 : false;
  const selectToken = (value: string) => { setMint(value); setMintInput(value); setBacktest(null); };
  const runBacktest = async () => {
    if (!mint) return;
    setBacktestState('loading'); setBacktest(null);
    try {
      const response = await fetch('/api/v1/analytics/backtest', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint, timeframe: interval, costPerSidePct: cost }), cache: 'no-store' });
      if (!response.ok) throw new Error();
      setBacktest(await response.json()); setBacktestState('idle');
    } catch { setBacktestState('error'); }
  };

  return <div className="space-y-4 pb-8">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
      <div><button type="button" onClick={onBack} className="mb-2 inline-flex min-h-10 items-center gap-1 text-xs text-sky-300 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><ArrowLeft className="h-4 w-4" />Back to overview</button>
        <h1 className="text-xl font-semibold text-slate-100">Research workspace</h1>
        <p className="mt-1 text-xs text-slate-400">Measured observations only. Missing evidence stays unreported.</p></div>
      <div className="flex items-center gap-2"><span className={`rounded-md border px-2 py-2 text-[11px] ${delayed ? 'border-amber-800 text-amber-300' : 'border-slate-700 text-slate-300'}`}><Clock3 className="mr-1 inline h-3 w-3" />{market ? `${delayed ? 'Delayed' : 'Latest'} · ${when(market.coverage.updatedAt)}` : 'Awaiting observations'}</span>
        <button type="button" onClick={() => setRevision(v => v + 1)} className="min-h-10 rounded-md border border-slate-700 px-3 text-xs text-slate-200 hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />Refresh</button></div>
    </div>
    <nav aria-label="Research sections" className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-2">{sections.map(item => <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-pressed={section === item.id}
      className={`min-h-10 shrink-0 rounded-md px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${section === item.id ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>{item.label}</button>)}</nav>
    {(marketError || researchError) && <p role="alert" className="rounded-md border border-amber-900 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">A measured data feed is unavailable. Any previous observations remain visible.</p>}

    {!['market', 'volume'].includes(section) && <Panel title="Token context" detail="Exact mint selection; symbol matches are not used.">
      <form onSubmit={event => { event.preventDefault(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintInput)) selectToken(mintInput); }} className="flex flex-wrap gap-2">
        <label htmlFor="research-token" className="sr-only">Solana mint</label><input id="research-token" value={mintInput} onChange={event => setMintInput(event.target.value.trim())} placeholder="Paste a Solana mint" required minLength={32} maxLength={44} pattern="[1-9A-HJ-NP-Za-km-z]{32,44}" title="Enter a valid 32–44 character Solana mint address"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400" />
        <button type="submit" className="min-h-10 rounded-md bg-sky-600 px-3 text-xs font-medium text-white hover:bg-sky-500">Inspect</button>
        {token && <Link href={`/trade/solana/${token.mint}`} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-700 px-3 text-xs text-sky-300 hover:border-sky-500">Trade view <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
      </form>{token && <p className="mt-2 text-xs text-slate-400">{token.symbol || shorten(token.mint)} · {shorten(token.mint)} · observed {when(token.observedAt)}</p>}
    </Panel>}

    {section === 'market' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Fact label="Priced tokens" value={fmt(market?.coverage.tokenCount)} detail="Tracked locally" />
      <Fact label="24h volume" value={usd(flow?.totalVolumeUsd)} /><Fact label="Liquidity" value={usd(market?.coverage.totalLiquidityUsd)} />
      <Fact label="Net breadth" value={measured ? pct(((breadth!.advancing - breadth!.declining) / measured) * 100) : '—'} detail="Share of measured tokens" />
    </div><div className="grid gap-4 lg:grid-cols-2"><Panel title="Advancing vs declining" detail="Measured 24h direction, not a predictive regime score.">
      {measured ? <Split a={breadth!.advancing} b={breadth!.declining} aName="Advancing" bName="Declining" /> : <Note>No measured direction available.</Note>}
      {breadth && <p className="mt-3 text-xs text-slate-400">{fmt(breadth.unchanged)} unchanged · {fmt(breadth.unknown)} unknown</p>}</Panel>
      <Panel title="Reading the snapshot"><p className="text-xs leading-5 text-slate-300">These values describe tracked Solana tokens, not the entire network. Observation times can differ by token. No confidence percentage or market forecast is generated from this snapshot.</p></Panel></div></div>}

    {section === 'volume' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Fact label="Reported volume" value={usd(flow?.totalVolumeUsd)} /><Fact label="Buy volume" value={usd(flow?.buyVolumeUsd)} /><Fact label="Sell volume" value={usd(flow?.sellVolumeUsd)} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><Panel title="Directional flow" detail="Recorded buys and sells may have different coverage than total volume.">
        {flow?.buyVolumeUsd != null && flow.sellVolumeUsd != null ? <Split a={flow.buyVolumeUsd} b={flow.sellVolumeUsd} aName="Buys" bName="Sells" /> : <Note>Directional trade volume is not measured.</Note>}</Panel>
        <Panel title="Organic-volume coverage"><div className="grid grid-cols-2 gap-3"><Fact label="Observed organic" value={usd(flow?.organicVolumeUsd)} /><Fact label="Share of covered" value={flow?.organicVolumePct == null ? '—' : `${flow.organicVolumePct.toFixed(1)}%`} /></div>
          <p className="mt-3 text-xs text-slate-400">{fmt(market?.coverage.organicCoverageTokens)} tokens · {usd(flow?.organicEligibleVolumeUsd)} comparable volume</p></Panel></div>
      <Note>Non-organic volume is not automatically wash trading. Verified wash-pattern detection needs transaction-level wallet clustering and is not claimed here.</Note></div>}

    {section === 'exit' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Fact label="Reported pool liquidity" value={usd(token?.liquidityUsd)} detail={token?.poolAddress ? `Pool ${shorten(token.poolAddress)}` : 'Pool not recorded'} /><Fact label="24h volume" value={usd(token?.volume24hUsd)} />
      <Fact label="Position / liquidity" value={token?.liquidityUsd && size > 0 ? `${(size / token.liquidityUsd * 100).toFixed(2)}%` : '—'} detail="Not estimated price impact" /></div>
      <Panel title="Position context" detail="Compare size to observed liquidity; get an actual route quote before trading."><label htmlFor="research-size" className="text-xs text-slate-300">Position USD</label><input id="research-size" type="number" min="1" max="10000000" value={size} onChange={event => setSize(Math.max(1, Number(event.target.value) || 1))} className="ml-3 min-h-10 w-36 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-xs text-slate-100" />
        <p className="mt-3 text-xs leading-5 text-slate-400">This ratio cannot estimate slippage or exitability: reserves, route, fees, and current liquidity are needed. No transaction is submitted.</p></Panel></div>}

    {section === 'wallets' && <Panel title="Observed wallet activity" detail="Recorded trades for the selected token in the last 24 hours. Processed trades are provisional until confirmed.">
      {!mint ? <Note>Select a token first.</Note> : researchError && !research ? <Note>Wallet activity is unavailable while the token store cannot be read.</Note>
        : research?.selectedMint !== mint ? <Note>Loading activity for this mint…</Note>
        : !research.observedWallets.length ? <Note>No wallet trades were recorded for this token in the last 24 hours.</Note>
        : <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="text-slate-400"><tr><th className="pb-2">Wallet</th><th>Buys</th><th>Sells</th><th>Provisional</th><th>Last observed</th></tr></thead><tbody>{research.observedWallets.map(row => <tr key={row.address} className="border-t border-slate-800 text-slate-200"><td className="py-2 font-mono">{shorten(row.address)}</td><td>{row.buys}</td><td>{row.sells}</td><td>{row.provisional}</td><td>{when(row.lastSeen)}</td></tr>)}</tbody></table></div>}
      <p className="mt-4 text-xs text-slate-400">Realized P&amp;L, shared funding, and smart-money classification require verified wallet histories.</p></Panel>}

    {section === 'trader' && <div className="space-y-4">{ordersState === 'auth' ? <Note>Sign in to inspect your own orders. Personal data is not exposed in public analytics.</Note>
      : ordersState === 'loading' ? <Note>Loading recorded orders…</Note> : ordersState === 'error' ? <Note>Order history is unavailable right now.</Note>
      : !orders?.length ? <Note>No orders have been recorded for this account.</Note> : <><div className="grid gap-3 sm:grid-cols-3"><Fact label="Recorded orders" value={fmt(orders.length)} detail="Latest 100" /><Fact label="Filled" value={fmt(orders.filter(o => o.status === 'FILLED').length)} /><Fact label="Open or pending" value={fmt(orders.filter(o => !['FILLED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(o.status)).length)} /></div>
      <Panel title="Recent orders" detail="Order status is not realized P&L; that requires reconciled fills and cost basis."><div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left text-xs"><thead className="text-slate-400"><tr><th className="pb-2">Token</th><th>Side</th><th>Status</th><th>Filled</th><th>Created</th></tr></thead><tbody>{orders.slice(0, 20).map(o => <tr key={o.id} className="border-t border-slate-800 text-slate-200"><td className="py-2">{o.tokenSymbol || 'Unknown'}</td><td className="uppercase">{o.side}</td><td>{o.status}</td><td>{o.filledQuantity ?? '—'}</td><td>{when(o.timestamp)}</td></tr>)}</tbody></table></div></Panel></>}</div>}

    {section === 'rankings' && <Panel title="Measured token rankings" detail="Eligible tokens have a measured price, ≥$1K liquidity, and ≥$100 reported 24h volume."><div className="mb-4 flex flex-wrap gap-2">{rankings.map(item => <button key={item.id} type="button" onClick={() => setRanking(item.id)} aria-pressed={ranking === item.id} className={`min-h-10 rounded-md border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${ranking === item.id ? 'border-sky-500 bg-sky-500/15 text-sky-300' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{item.label}</button>)}</div>
      {researchError && !research ? <Note>Measured token rankings are unavailable while the token store cannot be read.</Note>
        : research?.sort !== ranking ? <Note>Refreshing this ranking…</Note> : !research.ranked.length ? <Note>No eligible measured tokens are available.</Note> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs"><thead className="text-slate-400"><tr><th className="pb-2">Token</th><th>24h</th><th>Volume</th><th>Liquidity</th><th>Observed</th><th>Action</th></tr></thead><tbody>{research.ranked.map(row => <tr key={row.mint} className="border-t border-slate-800 text-slate-200"><td className="py-2 font-semibold">{row.symbol || shorten(row.mint)} <span className="font-normal text-slate-400">{row.name}</span></td><td className={`font-mono ${row.change24hPct != null && row.change24hPct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{pct(row.change24hPct)}</td><td className="font-mono">{usd(row.volume24hUsd)}</td><td className="font-mono">{usd(row.liquidityUsd)}</td><td>{when(row.observedAt)}</td><td><button type="button" onClick={() => selectToken(row.mint)} className="min-h-10 text-sky-300 hover:underline">Select</button></td></tr>)}</tbody></table></div>}</Panel>}

    {section === 'backtest' && <Panel title="Measured historical backtest" detail="Long-only 5/20 SMA crossover. A closed-candle signal executes at the next candle open."><div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-300">Interval<select value={interval} onChange={event => setInterval(event.target.value as typeof interval)} className="mt-1 block min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100"><option value="15m">15m</option><option value="1h">1h</option><option value="4h">4h</option><option value="1d">1d</option></select></label>
      <label className="text-xs text-slate-300">Cost per side (%)<input type="number" min="0" max="5" step="0.1" value={cost} onChange={event => setCost(Number(event.target.value))} className="mt-1 block min-h-10 w-28 rounded-md border border-slate-700 bg-slate-950 px-3 font-mono text-slate-100" /></label>
      <button type="button" onClick={() => void runBacktest()} disabled={!mint || backtestState === 'loading' || !Number.isFinite(cost) || cost < 0 || cost > 5} className="min-h-10 rounded-md bg-sky-600 px-4 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50">{backtestState === 'loading' ? 'Loading candles…' : 'Run on measured candles'}</button></div>
      <p className="my-4 text-xs leading-5 text-slate-400">Up to 500 real USD candles. The latest potentially open candle and unclosed positions are excluded. Cost is a disclosed assumption, not a quoted fee.</p>
      {backtestState === 'error' && <Note>Measured candle history is unavailable. No result was generated.</Note>}
      {visibleBacktest?.result.status === 'insufficient' && <Note>Only {visibleBacktest.result.bars} usable candles are available; at least 30 are required. No performance claim is made.</Note>}
      {visibleBacktest?.result.status === 'measured' && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Fact label="Closed trades" value={fmt(visibleBacktest.result.closedTrades)} /><Fact label="Win rate" value={pct(visibleBacktest.result.winRatePct)} /><Fact label="Compounded return" value={pct(visibleBacktest.result.compoundedReturnPct)} /><Fact label="Closed-trade drawdown" value={pct(visibleBacktest.result.maxClosedTradeDrawdownPct)} /></div>
        <Note>{visibleBacktest.result.closedTrades ? `${visibleBacktest.result.closedTrades} closed trades across ${visibleBacktest.result.bars} candles.` : 'No closed trades occurred; return metrics remain unknown.'} Data {visibleBacktest.freshness === 'stale' ? 'was stale at retrieval' : 'was measured'}. Past performance does not predict future results.</Note>
        {visibleBacktest.result.trades.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[380px] text-left text-xs"><thead className="text-slate-400"><tr><th className="pb-2">Entry</th><th>Exit</th><th>Net return</th></tr></thead><tbody>{visibleBacktest.result.trades.slice(-20).map(trade => <tr key={`${trade.entryTime}-${trade.exitTime}`} className="border-t border-slate-800 text-slate-200"><td className="py-2">{when(new Date(trade.entryTime * 1000).toISOString())}</td><td>{when(new Date(trade.exitTime * 1000).toISOString())}</td><td className={`font-mono ${trade.netReturnPct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{pct(trade.netReturnPct)}</td></tr>)}</tbody></table></div>}</div>}
    </Panel>}
  </div>;
}
