'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Network,
  RefreshCw,
  Maximize2,
  Minimize2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getInsightXAtlasEmbedUrl, toInsightXNetwork } from '@/lib/insightx/atlas-embed';
import type { InsightXTokenIntelligence } from '@/lib/insightx/types';

export interface AtlasLivePanelProps {
  chain: string;
  address: string;
  symbol?: string;
  compact?: boolean;
  onIntelligenceLoaded?: (data: InsightXTokenIntelligence) => void;
}

function formatMetricPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function formatShortAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTagLabel(tag: string): string {
  return tag.replace(/_/g, ' ');
}

function getTagTone(tag: string): string {
  switch (tag) {
    case 'volume_bot':
    case 'intermediary':
      return 'border-rose-500/35 bg-rose-500/10 text-rose-300';
    case 'funding_address':
    case 'team':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    case 'liquidity_pool':
    case 'burn':
    case 'exchange':
      return 'border-sky-500/35 bg-sky-500/10 text-sky-300';
    default:
      return 'border-slate-700 bg-slate-900/70 text-slate-300';
  }
}

export function AtlasLivePanel({
  chain,
  address,
  symbol,
  compact = false,
  onIntelligenceLoaded,
}: AtlasLivePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intel, setIntel] = useState<InsightXTokenIntelligence | null>(null);
  const [clustersOpen, setClustersOpen] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const network = toInsightXNetwork(chain);
  const atlasEmbedUrl = getInsightXAtlasEmbedUrl(chain, address);

  const fetchIntelligence = useCallback(
    async (detail: 'core' | 'full' = 'core') => {
      const cleanAddr = address.trim();
      if (!cleanAddr) return;
      setLoadingIntel(true);
      try {
        const normalizedRouteChain = network === 'sol' ? 'solana' : chain.toLowerCase();
        const suffix = detail === 'full' ? '?detail=full' : '';
        const res = await fetch(
          `/api/v1/tokens/${encodeURIComponent(normalizedRouteChain)}/${encodeURIComponent(cleanAddr)}/insightx${suffix}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const json = await res.json();
        const payload = (json?.data ?? null) as InsightXTokenIntelligence | null;
        if (payload) {
          setIntel(payload);
          onIntelligenceLoaded?.(payload);
        }
      } catch {
        // Fail soft: Atlas Live iframe remains interactive independently.
      } finally {
        setLoadingIntel(false);
      }
    },
    [address, chain, network, onIntelligenceLoaded],
  );

  useEffect(() => {
    setIframeLoaded(false);
    void fetchIntelligence('core');
  }, [fetchIntelligence]);

  const handleRefresh = () => {
    setIframeLoaded(false);
    setReloadNonce((n) => n + 1);
    void fetchIntelligence(intel?.detailLevel === 'full' ? 'full' : 'core');
  };

  const handleCopy = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedAddr(value);
    setTimeout(() => setCopiedAddr((curr) => (curr === value ? null : curr)), 1600);
  };

  const heightClass = expanded
    ? 'h-[640px]'
    : compact
      ? 'h-[430px]'
      : 'h-[540px]';

  const metrics = intel?.metrics ?? null;
  const rawDist = intel?.distribution ?? null;
  const hasMeaningfulDistribution = Boolean(
    rawDist &&
    ((rawDist.gini ?? 0) > 0 || (rawDist.hhi ?? 0) > 0 || (rawDist.nakamoto ?? 0) > 0),
  );
  const distribution = hasMeaningfulDistribution ? rawDist : null;
  const clustersSummary = intel?.clusters ?? null;
  const scannerSimple = intel?.scanner?.results?.simple ?? null;

  return (
    <div className="space-y-3" data-testid="insightx-atlas-panel">
      {/* Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sentinel-800 bg-sentinel-950/90 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1">
            <Network className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-xs font-bold text-white">Holder Cluster Map</span>
          </div>
          <Badge variant="mono" size="sm">
            {network === 'sol' ? 'SOLANA' : network.toUpperCase()}
          </Badge>
          {intel?.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
              <Sparkles className="h-3 w-3" />
              Live Telemetry
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-slate-400">
              Interactive Graph
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {intel?.configured && intel.detailLevel !== 'full' && (
            <button
              type="button"
              onClick={() => void fetchIntelligence('full')}
              disabled={loadingIntel}
              title="Run full cluster audit (Distribution, Scanner & Snipers)"
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition"
            >
              <Sparkles className="h-3 w-3" />
              <span>Deep Audit</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? 'Collapse map height' : 'Expand map height'}
            className="inline-flex items-center gap-1 rounded-lg border border-sentinel-800 bg-sentinel-900 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-700 hover:text-white transition"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingIntel}
            title="Refresh cluster map & metrics"
            className="inline-flex items-center gap-1 rounded-lg border border-sentinel-800 bg-sentinel-900 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingIntel ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quantitative InsightX Telemetry Strip (only when INSIGHTX_API_KEY is configured and data returns) */}
      {intel?.configured && (metrics || distribution || clustersSummary || scannerSimple) && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-numeric">
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
              <span className="block font-mono text-[10px] uppercase text-slate-400">Cluster Supply</span>
              <span
                className={`mt-0.5 block font-mono text-sm font-bold ${
                  (metrics?.cluster_pct ?? clustersSummary?.totalClusterPct ?? 0) >= 20
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {formatMetricPct(metrics?.cluster_pct ?? clustersSummary?.totalClusterPct)}
              </span>
            </div>

            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
              <span className="block font-mono text-[10px] uppercase text-slate-400">Top 10 Supply</span>
              <span className="mt-0.5 block font-mono text-sm font-bold text-white">
                {formatMetricPct(metrics?.top10_pct ?? distribution?.top10Pct)}
              </span>
            </div>

            {intel.capabilities.snipersAndBundlers ? (
              <>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Snipers</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-rose-300">
                    {formatMetricPct(metrics?.snipers_pct)}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Bundlers</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-amber-300">
                    {formatMetricPct(metrics?.bundlers_pct)}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Insiders</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-purple-300">
                    {formatMetricPct(metrics?.insiders_pct)}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Dev Holding</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-sky-300">
                    {formatMetricPct(metrics?.dev_pct)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Clusters</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-sky-300">
                    {clustersSummary ? `${clustersSummary.clusterCount} total` : '—'}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Gini Index</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-white">
                    {distribution?.gini !== null && distribution?.gini !== undefined
                      ? distribution.gini.toFixed(3)
                      : '—'}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">HHI</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-white">
                    {distribution?.hhi !== null && distribution?.hhi !== undefined
                      ? distribution.hhi.toFixed(3)
                      : '—'}
                  </span>
                </div>
                <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">Nakamoto</span>
                  <span className="mt-0.5 block font-mono text-sm font-bold text-emerald-400">
                    {distribution?.nakamoto !== null && distribution?.nakamoto !== undefined
                      ? distribution.nakamoto
                      : '—'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Distribution inequality & scanner bar for Solana / EVM */}
          {(distribution || scannerSimple) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sentinel-800 bg-sentinel-950/60 px-3 py-2 font-mono text-[11px] text-slate-300">
              {distribution?.gini !== null && distribution?.gini !== undefined && (
                <span>
                  Gini: <strong className="text-white">{distribution.gini.toFixed(3)}</strong>
                </span>
              )}
              {distribution?.hhi !== null && distribution?.hhi !== undefined && (
                <span>
                  HHI: <strong className="text-white">{distribution.hhi.toFixed(3)}</strong>
                </span>
              )}
              {distribution?.nakamoto !== null && distribution?.nakamoto !== undefined && (
                <span>
                  Nakamoto: <strong className="text-emerald-300">{distribution.nakamoto}</strong>
                </span>
              )}
              {scannerSimple && typeof scannerSimple.score === 'number' && (
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Scanner Score: <strong>{scannerSimple.score}</strong>
                  {scannerSimple.message ? ` (${scannerSimple.message})` : ''}
                </span>
              )}
            </div>
          )}

          {/* Expandable Cluster Breakdown */}
          {clustersSummary && clustersSummary.clusters.length > 0 && (
            <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80">
              <button
                type="button"
                onClick={() => setClustersOpen((open) => !open)}
                className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-xs text-slate-200 hover:bg-white/[0.02] transition"
              >
                <span className="inline-flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {clustersSummary.clusterCount} Wallet Clusters Identified (
                    {clustersSummary.clusteredAddressCount} wallets •{' '}
                    {clustersSummary.suspiciousClusterCount} suspicious)
                  </span>
                </span>
                {clustersOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {clustersOpen && (
                <div className="max-h-56 overflow-y-auto divide-y divide-sentinel-800 border-t border-sentinel-800 px-3 py-1">
                  {clustersSummary.clusters.slice(0, 10).map((cluster, idx) => (
                    <div key={idx} className="py-2 space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-white">Cluster #{idx + 1}</span>
                          <span className="font-mono text-amber-300">
                            {formatMetricPct(cluster.pct)} supply
                          </span>
                          {(cluster.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${getTagTone(tag)}`}
                            >
                              {formatTagLabel(tag)}
                            </span>
                          ))}
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          {cluster.cluster_addresses?.length ?? 0} wallets
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(cluster.cluster_addresses ?? []).slice(0, 6).map((member) => (
                          <button
                            key={member.address}
                            type="button"
                            onClick={() => handleCopy(member.address)}
                            className="inline-flex items-center gap-1 rounded border border-sentinel-800 bg-[#080b12] px-2 py-0.5 font-mono text-[10px] text-slate-300 hover:border-sky-500/40 hover:text-white transition"
                            title={`Copy ${member.address}`}
                          >
                            <span>{formatShortAddress(member.address)}</span>
                            <span className="text-slate-500">({member.percentage.toFixed(2)}%)</span>
                            {copiedAddr === member.address ? (
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 text-slate-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main View: Interactive Holder Cluster Map */}
      <div className="space-y-2">
        {intel && !intel.configured && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 font-mono text-[11px] text-slate-300">
            <span>
              Interactive cluster graph is active. Extended holder metrics are currently unavailable.
            </span>
          </div>
        )}

        {intel?.configured && intel.rateLimit?.coolingDown && !metrics && !clustersSummary && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 font-mono text-[11px] text-amber-200">
            <span>
              Cluster metrics are temporarily rate-limited — interactive graph remains active and metrics will retry automatically.
            </span>
          </div>
        )}

        {atlasEmbedUrl ? (
          <div className={`relative w-full overflow-hidden rounded-xl border border-sentinel-800 bg-[#080b12] ${heightClass}`}>
            {!iframeLoaded && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#080b12]/90 font-mono text-xs text-slate-400">
                <Network className="h-6 w-6 animate-pulse text-sky-400" />
                <span>Loading Cluster Map ({symbol || formatShortAddress(address)})…</span>
              </div>
            )}
            <iframe
              key={`${atlasEmbedUrl}-${reloadNonce}`}
              src={atlasEmbedUrl}
              title={`Cluster Map for ${symbol || address}`}
              onLoad={() => setIframeLoaded(true)}
              loading="lazy"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              className="h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-sentinel-800 bg-sentinel-950/80 p-6 text-center font-mono text-xs text-slate-400">
            Provide a valid token contract address to render the cluster map.
          </div>
        )}
      </div>
    </div>
  );
}
