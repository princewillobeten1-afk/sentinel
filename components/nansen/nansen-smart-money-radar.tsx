'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Brain,
  Check,
  Copy,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Trophy,
  ArrowLeftRight,
} from 'lucide-react';
import type {
  NansenRadarView,
  NansenSmartMoneyPnlLeaderboardItem,
  NansenSmartMoneyRadarResponse,
} from '@/lib/nansen/types';

export interface NansenSmartMoneyRadarProps {
  onTrackWallet?: (item: NansenSmartMoneyPnlLeaderboardItem, chain: string) => void;
  isTracked?: (address: string) => boolean;
}

type ChainFilter = 'solana' | 'robinhood' | 'all';

const VIEW_TABS: Array<{ id: NansenRadarView; label: string; credits: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'screener', label: 'Smart Screener', credits: '1 cr', icon: Brain },
  { id: 'netflow', label: 'Netflows', credits: '5 cr', icon: TrendingUp },
  { id: 'holdings', label: 'Holdings', credits: '5 cr', icon: Layers },
  { id: 'dex-trades', label: 'Live DEX Trades', credits: '5 cr', icon: ArrowLeftRight },
  { id: 'leaderboard', label: 'PnL Leaderboard', credits: '5 cr', icon: Trophy },
];

function fmtUsdSigned(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const abs = Math.abs(val);
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtUsd(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function tradeHref(chain: string, tokenAddress: string): string {
  const c = chain.toLowerCase() === 'robinhood' ? 'robinhood' : 'solana';
  return `/trade/${c}/${tokenAddress}`;
}

export function NansenSmartMoneyRadar({ onTrackWallet, isTracked }: NansenSmartMoneyRadarProps) {
  const [chain, setChain] = useState<ChainFilter>('solana');
  const [view, setView] = useState<NansenRadarView>('screener');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NansenSmartMoneyRadarResponse | null>(null);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const loadView = useCallback(
    async (selectedChain: ChainFilter, selectedView: NansenRadarView, signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/nansen/smart-money?chain=${encodeURIComponent(selectedChain)}&view=${encodeURIComponent(selectedView)}&timeframe=24h&limit=25`,
          { cache: 'no-store', signal, priority: 'high' } as RequestInit,
        );
        if (!res.ok || signal?.aborted) return;
        const json = await res.json();
        if (!signal?.aborted && json?.data) {
          setData(json.data as NansenSmartMoneyRadarResponse);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Fail soft cleanly
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadView(chain, view, controller.signal);
    return () => controller.abort();
  }, [chain, view, loadView]);

  const handleCopy = (addr: string) => {
    navigator.clipboard?.writeText(addr).catch(() => {});
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr((curr) => (curr === addr ? null : curr)), 1600);
  };

  const rateLimit = data?.rateLimit;

  return (
    <div className="space-y-4" data-testid="nansen-smart-money-radar">
      {/* Top Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1E222D] bg-[#0D1015] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
            <Brain className="h-4 w-4" />
            <span>Nansen Smart Money</span>
          </div>

          {/* Chain Toggle */}
          <div className="inline-flex rounded-lg border border-[#1E222D] bg-[#06070B] p-0.5 font-mono text-xs">
            {(
              [
                { id: 'solana', label: 'Solana' },
                { id: 'robinhood', label: 'Robinhood' },
                { id: 'all', label: 'All Chains' },
              ] as Array<{ id: ChainFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChain(opt.id)}
                className={`rounded-md px-2.5 py-1 transition ${
                  chain === opt.id
                    ? 'bg-[#526FFF]/20 text-[#8EA2FF] font-semibold'
                    : 'text-[#828598] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {typeof rateLimit?.creditsRemaining === 'number' && (
            <span className="font-mono text-xs text-[#828598]">
              Credits remaining: <strong className="text-white">{rateLimit.creditsRemaining.toLocaleString()}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadView(chain, view)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E222D] bg-[#06070B] px-3 py-1.5 font-mono text-xs text-[#C8C9D1] hover:border-[#32374A] hover:text-white disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#1E222D] bg-[#090B10] p-1.5 font-mono text-xs">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                active
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-semibold'
                  : 'text-[#828598] hover:text-white border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span className="rounded bg-[#06070B] px-1.5 py-px text-[10px] text-slate-400">
                {tab.credits}
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Notices */}
      {data && !data.configured && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 font-mono text-xs text-slate-200">
          Add <code className="text-emerald-300">NANSEN_API_KEY=</code> to{' '}
          <code className="text-emerald-300">.env</code> to stream live Nansen Smart Money Screener tokens, 1h/24h/7d/30d netflows, holdings, DEX swaps, and PnL leaderboards across Solana and Robinhood Chain.
        </div>
      )}

      {data?.configured && rateLimit?.insufficientCredits && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 font-mono text-xs text-rose-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Nansen credit balance is exhausted — top up credits in your Nansen dashboard to resume live Smart Money queries.</span>
        </div>
      )}

      {data?.configured && rateLimit?.authFailed && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 font-mono text-xs text-rose-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Nansen API key rejected (`401`/`403`). Verify `NANSEN_API_KEY` in `.env` has the `data` scope.</span>
        </div>
      )}

      {/* Table Output per View */}
      {view === 'screener' && (
        <div className="overflow-x-auto rounded-xl border border-[#1E222D] bg-[#0D1015]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1E222D] bg-[#06070B] text-[10px] uppercase text-[#828598]">
              <tr>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Chain</th>
                <th className="px-4 py-3 text-right">SM Netflow (24h)</th>
                <th className="px-4 py-3 text-right">SM Traders</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Market Cap</th>
                <th className="px-4 py-3 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222D]/80">
              {!data || data.screener.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#828598]">
                    {loading ? 'Loading Nansen Smart Screener…' : data?.configured ? 'No Smart Money screener rows returned.' : 'Awaiting NANSEN_API_KEY.'}
                  </td>
                </tr>
              ) : (
                data.screener.map((row) => (
                  <tr key={`${row.chain}-${row.token_address}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">
                      {row.token_symbol || shortAddr(row.token_address)}
                      <span className="block text-[10px] font-normal text-[#828598]">
                        {shortAddr(row.token_address)}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-[#8EA2FF]">{row.chain}</td>
                    <td className={`px-4 py-3 text-right font-bold ${(row.netflow ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {fmtUsdSigned(row.netflow)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-300">{row.nof_traders ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-white">{fmtUsd(row.volume)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmtUsd(row.market_cap_usd)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={tradeHref(row.chain, row.token_address)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <span>Trade</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'netflow' && (
        <div className="overflow-x-auto rounded-xl border border-[#1E222D] bg-[#0D1015]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1E222D] bg-[#06070B] text-[10px] uppercase text-[#828598]">
              <tr>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Chain</th>
                <th className="px-4 py-3 text-right">1H Netflow</th>
                <th className="px-4 py-3 text-right">24H Netflow</th>
                <th className="px-4 py-3 text-right">7D Netflow</th>
                <th className="px-4 py-3 text-right">30D Netflow</th>
                <th className="px-4 py-3 text-right">Traders</th>
                <th className="px-4 py-3 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222D]/80">
              {!data || data.netflows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#828598]">
                    {loading ? 'Loading Nansen Netflows…' : data?.configured ? 'No Smart Money netflows returned.' : 'Awaiting NANSEN_API_KEY.'}
                  </td>
                </tr>
              ) : (
                data.netflows.map((row) => (
                  <tr key={`${row.chain}-${row.token_address}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">
                      {row.token_symbol}
                      <span className="block text-[10px] font-normal text-[#828598]">{shortAddr(row.token_address)}</span>
                    </td>
                    <td className="px-4 py-3 uppercase text-[#8EA2FF]">{row.chain}</td>
                    <td className={`px-4 py-3 text-right ${row.net_flow_1h_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtUsdSigned(row.net_flow_1h_usd)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${row.net_flow_24h_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtUsdSigned(row.net_flow_24h_usd)}</td>
                    <td className={`px-4 py-3 text-right ${row.net_flow_7d_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtUsdSigned(row.net_flow_7d_usd)}</td>
                    <td className={`px-4 py-3 text-right ${row.net_flow_30d_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtUsdSigned(row.net_flow_30d_usd)}</td>
                    <td className="px-4 py-3 text-right text-sky-300">{row.trader_count}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={tradeHref(row.chain, row.token_address)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <span>Trade</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'holdings' && (
        <div className="overflow-x-auto rounded-xl border border-[#1E222D] bg-[#0D1015]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1E222D] bg-[#06070B] text-[10px] uppercase text-[#828598]">
              <tr>
                <th className="px-4 py-3">Token</th>
                <th className="px-4 py-3">Chain</th>
                <th className="px-4 py-3 text-right">SM Value USD</th>
                <th className="px-4 py-3 text-right">24h Balance Change</th>
                <th className="px-4 py-3 text-right">SM Holders</th>
                <th className="px-4 py-3 text-right">Share of SM Holdings</th>
                <th className="px-4 py-3 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222D]/80">
              {!data || data.holdings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#828598]">
                    {loading ? 'Loading Nansen Smart Money Holdings…' : data?.configured ? 'No Smart Money holdings returned.' : 'Awaiting NANSEN_API_KEY.'}
                  </td>
                </tr>
              ) : (
                data.holdings.map((row) => (
                  <tr key={`${row.chain}-${row.token_address}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">
                      {row.token_symbol}
                      <span className="block text-[10px] font-normal text-[#828598]">{shortAddr(row.token_address)}</span>
                    </td>
                    <td className="px-4 py-3 uppercase text-[#8EA2FF]">{row.chain}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">{fmtUsd(row.value_usd)}</td>
                    <td className={`px-4 py-3 text-right ${(row.balance_24h_percent_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {typeof row.balance_24h_percent_change === 'number'
                        ? `${(row.balance_24h_percent_change * 100).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-300">{row.holders_count}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {typeof row.share_of_holdings_percent === 'number'
                        ? `${(row.share_of_holdings_percent * 100).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={tradeHref(row.chain, row.token_address)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <span>Trade</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'dex-trades' && (
        <div className="overflow-x-auto rounded-xl border border-[#1E222D] bg-[#0D1015]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1E222D] bg-[#06070B] text-[10px] uppercase text-[#828598]">
              <tr>
                <th className="px-4 py-3">Trader</th>
                <th className="px-4 py-3">Chain</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Bought</th>
                <th className="px-4 py-3 text-right">Trade USD</th>
                <th className="px-4 py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222D]/80">
              {!data || data.dexTrades.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#828598]">
                    {loading ? 'Loading Nansen Live DEX Trades…' : data?.configured ? 'No Smart Money DEX trades returned.' : 'Awaiting NANSEN_API_KEY.'}
                  </td>
                </tr>
              ) : (
                data.dexTrades.map((trade) => (
                  <tr key={trade.transaction_hash} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">
                        {trade.trader_address_label || shortAddr(trade.trader_address)}
                      </span>
                    </td>
                    <td className="px-4 py-3 uppercase text-[#8EA2FF]">{trade.chain}</td>
                    <td className="px-4 py-3 text-rose-300">{trade.token_sold_symbol}</td>
                    <td className="px-4 py-3 text-emerald-300 font-bold">
                      <Link href={tradeHref(trade.chain, trade.token_bought_address)} className="hover:underline">
                        {trade.token_bought_symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">{fmtUsd(trade.trade_value_usd)}</td>
                    <td className="px-4 py-3 text-right text-[#828598]">
                      {new Date(trade.block_timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'leaderboard' && (
        <div className="overflow-x-auto rounded-xl border border-[#1E222D] bg-[#0D1015]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-[#1E222D] bg-[#06070B] text-[10px] uppercase text-[#828598]">
              <tr>
                <th className="px-4 py-3">Smart Trader</th>
                <th className="px-4 py-3 text-right">Total PnL</th>
                <th className="px-4 py-3 text-right">Realized PnL</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">Avg ROI</th>
                <th className="px-4 py-3 text-right">Trades</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222D]/80">
              {!data || data.leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#828598]">
                    {loading ? 'Loading Nansen Smart Money Leaderboard…' : data?.configured ? 'No leaderboard entries returned.' : 'Awaiting NANSEN_API_KEY.'}
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((row) => {
                  const tracked = isTracked?.(row.address) ?? false;
                  return (
                    <tr key={row.address} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {row.address_label || shortAddr(row.address)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(row.address)}
                            className="text-slate-500 hover:text-white transition"
                            title={row.address}
                          >
                            {copiedAddr === row.address ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${row.total_pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtUsdSigned(row.total_pnl_usd)}
                      </td>
                      <td className={`px-4 py-3 text-right ${row.realized_pnl_usd >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {fmtUsdSigned(row.realized_pnl_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-sky-300">
                        {typeof row.win_rate === 'number' ? `${(row.win_rate * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {typeof row.avg_trade_roi === 'number' ? `${(row.avg_trade_roi * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{row.n_trades}</td>
                      <td className="px-4 py-3 text-right">
                        {onTrackWallet && (
                          <button
                            type="button"
                            disabled={tracked}
                            onClick={() => onTrackWallet(row, chain)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition ${
                              tracked
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default'
                                : 'border-[#526FFF]/40 bg-[#526FFF]/15 text-[#8EA2FF] hover:bg-[#526FFF]/25'
                            }`}
                          >
                            {tracked ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            <span>{tracked ? 'Tracked' : 'Track Wallet'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
