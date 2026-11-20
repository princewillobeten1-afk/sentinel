'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
  ArrowLeftRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getExplorerAddressUrl, getExplorerTxUrl } from '@/lib/chains/chain-config';
import { toNansenChain } from '@/lib/nansen/chains';
import type {
  NansenTgmDexTradeItem,
  NansenTgmFlowIntelligenceItem,
  NansenTgmHolderItem,
  NansenTgmTimeframe,
  NansenTgmWhoBoughtSoldItem,
  NansenTokenDetailLevel,
  NansenTokenSmartMoneyResponse,
} from '@/lib/nansen/types';

export interface NansenSmartMoneyPanelProps {
  chain: string;
  address: string;
  symbol?: string;
  compact?: boolean;
}

const TIMEFRAMES: NansenTgmTimeframe[] = ['1h', '6h', '1d', '7d'];

function formatUsdSigned(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const abs = Math.abs(val);
  const sign = val > 0 ? '+' : val < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatUsdPlain(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function formatShortAddr(addr?: string | null): string {
  if (!addr) return '—';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function flowTone(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val) || val === 0) return 'text-slate-300';
  return val > 0 ? 'text-emerald-400' : 'text-rose-400';
}

export function NansenSmartMoneyPanel({
  chain,
  address,
  symbol,
}: NansenSmartMoneyPanelProps) {
  const [timeframe, setTimeframe] = useState<NansenTgmTimeframe>('1d');
  const [subTab, setSubTab] = useState<NansenTokenDetailLevel>('core');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [nativeRestricted, setNativeRestricted] = useState(false);
  const [dexTradesRestricted, setDexTradesRestricted] = useState(false);
  const [rateLimit, setRateLimit] = useState<NansenTokenSmartMoneyResponse['rateLimit'] | null>(null);

  const [flowIntelligence, setFlowIntelligence] = useState<NansenTgmFlowIntelligenceItem | null>(null);
  const [smartBuyers, setSmartBuyers] = useState<NansenTgmWhoBoughtSoldItem[]>([]);
  const [smartSellers, setSmartSellers] = useState<NansenTgmWhoBoughtSoldItem[]>([]);
  const [dexTrades, setDexTrades] = useState<NansenTgmDexTradeItem[]>([]);
  const [smartHolders, setSmartHolders] = useState<NansenTgmHolderItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const nansenChain = toNansenChain(chain);
  const explorerChain = nansenChain === 'robinhood' ? 'robinhood' : 'solana';

  const loadDetail = useCallback(
    async (tf: NansenTgmTimeframe, detail: NansenTokenDetailLevel, signal?: AbortSignal) => {
      const cleanAddr = address.trim();
      if (!cleanAddr) return;
      setLoading(true);
      setLoadError(null);
      try {
        const routeChain = nansenChain === 'solana' ? 'solana' : chain.toLowerCase();
        const res = await fetch(
          `/api/v1/tokens/${encodeURIComponent(routeChain)}/${encodeURIComponent(cleanAddr)}/nansen?timeframe=${tf}&detail=${detail}`,
          { cache: 'no-store', signal, priority: 'high' } as RequestInit,
        );
        if (signal?.aborted) return;
        if (!res.ok) {
          setLoadError('Unable to reach Smart Money feed — click refresh to retry.');
          return;
        }
        const json = await res.json();
        if (signal?.aborted) return;
        const payload = (json?.data ?? null) as NansenTokenSmartMoneyResponse | null;
        if (!payload) {
          setLoadError('Unable to reach Smart Money feed — click refresh to retry.');
          return;
        }

        setConfigured(payload.configured);
        setNativeRestricted(Boolean(payload.nativeRestricted));
        setDexTradesRestricted(Boolean(payload.dexTradesRestricted));
        setRateLimit(payload.rateLimit);

        if (detail === 'core') {
          setFlowIntelligence(payload.flowIntelligence);
          setSmartBuyers(payload.smartBuyers ?? []);
        } else if (detail === 'trades') {
          setSmartSellers(payload.smartSellers ?? []);
          setDexTrades(payload.dexTrades ?? []);
        } else if (detail === 'holders') {
          setSmartHolders(payload.smartHolders ?? []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!signal?.aborted) {
          setLoadError('Unable to reach Smart Money feed — click refresh to retry.');
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [address, chain, nansenChain],
  );

  // Reset sub-state when switching token/chain/timeframe and load 2-credit core view
  useEffect(() => {
    const controller = new AbortController();
    setFlowIntelligence(null);
    setSmartBuyers([]);
    setSmartSellers([]);
    setDexTrades([]);
    setSmartHolders([]);
    setSubTab('core');
    void loadDetail(timeframe, 'core', controller.signal);
    return () => controller.abort();
  }, [address, chain, timeframe, loadDetail]);

  const handleSelectSubTab = (next: NansenTokenDetailLevel) => {
    setSubTab(next);
    if (next === 'trades' && dexTrades.length === 0 && smartSellers.length === 0 && configured) {
      void loadDetail(timeframe, 'trades');
    } else if (next === 'holders' && smartHolders.length === 0 && configured) {
      void loadDetail(timeframe, 'holders');
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(value);
    setTimeout(() => setCopiedKey((curr) => (curr === value ? null : curr)), 1600);
  };

  const cohorts = [
    {
      label: 'Smart Traders',
      net: flowIntelligence?.smart_trader_net_flow_usd,
      wallets: flowIntelligence?.smart_trader_wallet_count,
    },
    {
      label: 'Top PnL Wallets',
      net: flowIntelligence?.top_pnl_net_flow_usd,
      wallets: flowIntelligence?.top_pnl_wallet_count,
    },
    {
      label: 'Whales',
      net: flowIntelligence?.whale_net_flow_usd,
      wallets: flowIntelligence?.whale_wallet_count,
    },
    {
      label: 'Public Figures',
      net: flowIntelligence?.public_figure_net_flow_usd,
      wallets: flowIntelligence?.public_figure_wallet_count,
    },
    {
      label: 'Exchanges',
      net: flowIntelligence?.exchange_net_flow_usd,
      wallets: null,
    },
    {
      label: 'Fresh Wallets',
      net: flowIntelligence?.fresh_wallets_net_flow_usd,
      wallets: null,
    },
  ];

  return (
    <div className="space-y-3" data-testid="nansen-smart-money-panel">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sentinel-800 bg-sentinel-950/90 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1">
            <Brain className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-xs font-bold text-white">Smart Money</span>
          </div>
          <Badge variant="mono" size="sm">
            {nansenChain.toUpperCase()}
          </Badge>
          {configured === true ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
              Live
            </span>
          ) : configured === false ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-slate-400">
              Unavailable
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Timeframe Switcher */}
          <div className="inline-flex rounded-lg border border-sentinel-800 bg-[#080b12] p-0.5 font-mono text-[11px]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded-md px-2 py-1 transition ${
                  timeframe === tf
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadDetail(timeframe, subTab)}
            disabled={loading}
            title="Refresh Smart Money intelligence"
            className="inline-flex items-center gap-1 rounded-lg border border-sentinel-800 bg-sentinel-900 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {configured === false && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 font-mono text-[11px] text-slate-200">
          <span>
            Smart Money analytics are currently unavailable for {symbol || formatShortAddr(address)}.
          </span>
        </div>
      )}

      {configured && (rateLimit?.insufficientCredits || rateLimit?.authFailed) && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-3 py-2 font-mono text-[11px] text-rose-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Smart Money analytics are temporarily unavailable — please check back shortly.</span>
        </div>
      )}

      {configured && rateLimit?.coolingDown && !rateLimit.insufficientCredits && !rateLimit.authFailed && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[11px] text-amber-200">
          Smart Money feed is temporarily rate-limited — cached snapshots remain available and live requests will resume automatically.
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 font-mono text-[11px] text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{loadError}</span>
        </div>
      )}

      {/* 6-Cohort Flow Intelligence Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-numeric">
        {cohorts.map((cohort) => (
          <div key={cohort.label} className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
            <span className="block font-mono text-[10px] uppercase text-slate-400 truncate">
              {cohort.label}
            </span>
            <span className={`mt-0.5 block font-mono text-sm font-bold ${flowTone(cohort.net)}`}>
              {formatUsdSigned(cohort.net)}
            </span>
            <span className="block font-mono text-[10px] text-slate-500">
              {typeof cohort.wallets === 'number' && cohort.wallets > 0
                ? `${cohort.wallets} wallet${cohort.wallets === 1 ? '' : 's'}`
                : cohort.label === 'Fresh Wallets' && timeframe !== '1d' && timeframe !== '7d'
                  ? '1d/7d only'
                  : 'Net flow'}
            </span>
          </div>
        ))}
      </div>

      {/* Sub-View Switcher (On-Demand Quota Control) */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-sentinel-800 bg-[#080b12] p-1 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => handleSelectSubTab('core')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
            subTab === 'core'
              ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Smart Buyers</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubTab('trades')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
            subTab === 'trades'
              ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Smart Swaps & Sellers</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectSubTab('holders')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
            subTab === 'holders'
              ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Smart Holders</span>
        </button>
      </div>

      {/* Sub-View Body */}
      {subTab === 'core' && (
        <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-950/80">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-sentinel-800 bg-[#080b12] text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Smart Trader</th>
                <th className="px-3 py-2 text-right">Bought USD</th>
                <th className="px-3 py-2 text-right">Sold USD</th>
                <th className="px-3 py-2 text-right">Net USD</th>
                <th className="px-3 py-2 text-right">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-800/70">
              {smartBuyers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    {configured === false
                      ? 'Smart Money buyers are currently unavailable.'
                      : loading
                        ? 'Loading Smart Money buyers…'
                        : 'No Smart Money buyers recorded for this window.'}
                  </td>
                </tr>
              ) : (
                smartBuyers.map((buyer) => (
                  <tr key={buyer.address} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {buyer.address_label || formatShortAddr(buyer.address)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(buyer.address)}
                          className="text-slate-500 hover:text-white transition"
                          title={buyer.address}
                        >
                          {copiedKey === buyer.address ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-400">
                      {formatUsdPlain(buyer.bought_volume_usd)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {formatUsdPlain(buyer.sold_volume_usd)}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${flowTone(buyer.net_volume_usd)}`}>
                      {formatUsdSigned(buyer.net_volume_usd)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={getExplorerAddressUrl(explorerChain, buyer.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'trades' && (
        <div className="space-y-3">
          {dexTradesRestricted && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[11px] text-amber-200">
              DEX trade filtering restricts native gas tokens and Solana USDC; Smart Sellers below remains active where supported.
            </div>
          )}

          {/* Smart Money DEX Swaps */}
          <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-950/80">
            <div className="border-b border-sentinel-800 bg-[#080b12] px-3 py-2 font-mono text-[10px] uppercase text-slate-400">
              Recent Smart Money DEX Swaps
            </div>
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-sentinel-800 bg-[#080b12]/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Trader</th>
                  <th className="px-3 py-2 text-right">Value USD</th>
                  <th className="px-3 py-2 text-right">Time</th>
                  <th className="px-3 py-2 text-right">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-800/70">
                {dexTrades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                      {loading ? 'Loading Smart Money swaps…' : 'No Smart Money swaps returned for this window.'}
                    </td>
                  </tr>
                ) : (
                  dexTrades.map((trade) => (
                    <tr key={trade.transaction_hash} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            trade.action === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {trade.action === 'BUY' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {trade.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-white">
                        {trade.trader_address_label || formatShortAddr(trade.trader_address)}
                      </td>
                      <td className="px-3 py-2 text-right text-sky-300 font-semibold">
                        {formatUsdPlain(trade.estimated_value_usd)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {new Date(trade.block_timestamp).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={getExplorerTxUrl(explorerChain, trade.transaction_hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300"
                        >
                          <span>Tx</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Top Smart Sellers */}
          <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-950/80">
            <div className="border-b border-sentinel-800 bg-[#080b12] px-3 py-2 font-mono text-[10px] uppercase text-slate-400">
              Top Smart Money Net Sellers
            </div>
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-sentinel-800 bg-[#080b12]/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Smart Trader</th>
                  <th className="px-3 py-2 text-right">Sold USD</th>
                  <th className="px-3 py-2 text-right">Bought USD</th>
                  <th className="px-3 py-2 text-right">Net USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-800/70">
                {smartSellers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                      {loading ? 'Loading Smart Money sellers…' : 'No Smart Money sellers recorded for this window.'}
                    </td>
                  </tr>
                ) : (
                  smartSellers.map((seller) => (
                    <tr key={seller.address} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-white">
                        {seller.address_label || formatShortAddr(seller.address)}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-400">
                        {formatUsdPlain(seller.sold_volume_usd)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {formatUsdPlain(seller.bought_volume_usd)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${flowTone(seller.net_volume_usd)}`}>
                        {formatUsdSigned(seller.net_volume_usd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'holders' && (
        <div className="space-y-2">
          {nativeRestricted && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[11px] text-amber-200">
              Smart Holder tables are available for non-native SPL and ERC-20 tokens.
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-sentinel-800 bg-sentinel-950/80">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-sentinel-800 bg-[#080b12] text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Smart Money Holder</th>
                  <th className="px-3 py-2 text-right">Value USD</th>
                  <th className="px-3 py-2 text-right">Ownership %</th>
                  <th className="px-3 py-2 text-right">Total Inflow</th>
                  <th className="px-3 py-2 text-right">Total Outflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-800/70">
                {smartHolders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      {loading ? 'Loading Smart Money holders…' : 'No Smart Money holders returned for this token.'}
                    </td>
                  </tr>
                ) : (
                  smartHolders.map((holder, idx) => (
                    <tr key={holder.address ?? idx} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">
                            {holder.address_label || formatShortAddr(holder.address)}
                          </span>
                          {holder.address && (
                            <button
                              type="button"
                              onClick={() => handleCopy(holder.address!)}
                              className="text-slate-500 hover:text-white transition"
                              title={holder.address}
                            >
                              {copiedKey === holder.address ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400 font-semibold">
                        {formatUsdPlain(holder.value_usd)}
                      </td>
                      <td className="px-3 py-2 text-right text-sky-300">
                        {typeof holder.ownership_percentage === 'number'
                          ? `${holder.ownership_percentage.toFixed(2)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-400">
                        {typeof holder.total_inflow === 'number' ? holder.total_inflow.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-400">
                        {typeof holder.total_outflow === 'number' ? holder.total_outflow.toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
