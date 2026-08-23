'use client';

/**
 * Portfolio Risk Center (spec §58, §59, §60, §61, §65)
 *
 * A standalone, additive view that reads exclusively from the Sprint 9 v1
 * portfolio API. It does not replace or modify the existing Portfolio page —
 * it lives at /portfolio/risk so it can be wired into navigation later without
 * touching the view-switching store or sidebar.
 *
 * Design principle carried over from the engines: this page states facts and
 * observations. It never renders a "sell" or "buy" instruction (spec §63).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  PieChart,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { MetricTile } from '@/components/ui/metric-tile';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { useSession, usePrimaryWallet } from '@/lib/hooks/use-auth-hooks';
import type {
  MonetaryValue,
  PortfolioOverview,
  PortfolioRiskDriver,
  PortfolioRiskScore,
  Position,
  PositionChange,
} from '@/lib/portfolio/types';

type SortKey = 'VALUE' | 'PNL' | 'RISK' | 'ALLOCATION' | 'EXITABILITY';

interface OverviewResponse {
  overview: PortfolioOverview;
  changes: PositionChange[];
}

interface RiskResponse {
  portfolioRisk: PortfolioRiskScore;
  headline: string;
  drivers: string[];
}

interface PositionsResponse {
  positions: Position[];
}

async function fetchJson<T>(path: string, token?: string): Promise<T> {
  // The bearer header is optional — the `sentinel_session` cookie authenticates
  // on its own, and sending `Bearer null` would be worse than sending nothing.
  const res = await fetch(path, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body?.error?.message ?? `Request to ${path} failed`);
  }
  return body.data as T;
}

function moneyText(value: MonetaryValue): string {
  if (value.status === 'UNKNOWN') return 'Unknown';
  if (value.status === 'UNAVAILABLE') return 'Unavailable';
  if (value.usd === null) return 'Unavailable';
  const abs = Math.abs(value.usd);
  const sign = value.usd < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function riskBadgeVariant(band: string): 'success' | 'info' | 'warning' | 'danger' {
  switch (band) {
    case 'LOW':
      return 'success';
    case 'MODERATE':
      return 'info';
    case 'ELEVATED':
    case 'HIGH':
      return 'warning';
    default:
      return 'danger';
  }
}

export function PortfolioRiskCenter() {
  const { token } = useSession();
  const { address } = usePrimaryWallet();
  // No demo fallbacks. These substituted an invalid address and a fake token
  // whenever the real ones were absent, so a signed-out user silently requested
  // a stranger's portfolio and got a 403 instead of being told to connect.
  const wallet = address;
  const authToken = token;

  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [changes, setChanges] = useState<PositionChange[]>([]);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [sort, setSort] = useState<SortKey>('RISK');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to fetch without a wallet. Previously this ran regardless, using
    // a hardcoded demo address, and surfaced the resulting 403 as a failure.
    if (!wallet) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchJson<OverviewResponse>(`/api/v1/portfolio/${wallet}`, authToken ?? undefined),
      fetchJson<RiskResponse>(`/api/v1/portfolio/${wallet}/risk`, authToken ?? undefined),
      fetchJson<PositionsResponse>(`/api/v1/portfolio/${wallet}/positions?sort=${sort}`, authToken ?? undefined),
    ])
      .then(([overviewRes, riskRes, positionsRes]) => {
        if (cancelled) return;
        setOverview(overviewRes.overview);
        setChanges(overviewRes.changes);
        setRisk(riskRes);
        setPositions(positionsRes.positions);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load portfolio');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wallet, authToken, sort]);

  const columns = useMemo<Column<Position>[]>(
    () => [
      {
        key: 'token',
        header: 'Token',
        accessor: (position) => (
          <div>
            <p className="font-bold text-slate-100">
              {position.symbol}{' '}
              <span className="text-slate-500 font-mono text-2xs uppercase">{position.chain}</span>
            </p>
            {position.limitations.length > 0 && (
              <p className="text-2xs text-amber-400/80 mt-0.5 max-w-xs truncate" title={position.limitations[0]}>
                {position.limitations[0]}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'value',
        header: 'Value',
        align: 'right',
        isMonospace: true,
        accessor: (position) => (
          <div>
            <p className="font-bold text-slate-100">{moneyText(position.valuation.markValue)}</p>
            <p className="text-2xs text-slate-500">
              Exit: {moneyText(position.valuation.estimatedExitValue)}
            </p>
          </div>
        ),
      },
      {
        key: 'pnl',
        header: 'Net P&L',
        align: 'right',
        isMonospace: true,
        accessor: (position) => {
          const net = position.pnl.net;
          const positive = net.usd !== null && net.usd >= 0;
          return (
            <span className={positive ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {moneyText(net)}
            </span>
          );
        },
      },
      {
        key: 'allocation',
        header: 'Allocation',
        align: 'right',
        isMonospace: true,
        accessor: (position) =>
          position.allocationPct !== null ? `${(position.allocationPct * 100).toFixed(1)}%` : '—',
      },
      {
        key: 'risk',
        header: 'Risk',
        align: 'center',
        accessor: (position) => (
          <Badge variant={riskBadgeVariant(position.risk.band)} size="sm">
            {position.risk.score.toFixed(0)}
          </Badge>
        ),
      },
      {
        key: 'exitability',
        header: 'Exitability',
        align: 'center',
        accessor: (position) =>
          position.exitability ? (
            <span className={position.exitability.score < 50 ? 'text-amber-400 font-mono' : 'text-slate-300 font-mono'}>
              {position.exitability.score}
            </span>
          ) : (
            <span className="text-slate-600">—</span>
          ),
      },
    ],
    [],
  );

  if (!wallet) {
    return (
      <EmptyState
        icon={PieChart}
        title="No wallet connected"
        description="Connect a wallet to see its risk profile, exposure and exitability."
      />
    );
  }

  if (loading && !overview) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">Loading portfolio intelligence…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <EmptyState icon={AlertTriangle} title="Could not load portfolio" description={error} />
      </div>
    );
  }

  if (!overview || !risk) return null;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gauge className="h-6 w-6 text-sky-400" /> Portfolio Risk Center
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Decision support, not a balance tracker. Estimates are simulations, not guarantees of execution.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          title="Market Value"
          rawValue={moneyText(overview.totalValue)}
          adjustedValue={moneyText(overview.estimatedExitValue)}
          change={overview.todayChangePct !== null ? `${(overview.todayChangePct * 100).toFixed(1)}%` : undefined}
          changeType={overview.todayChangePct !== null && overview.todayChangePct >= 0 ? 'positive' : 'negative'}
          subtitle="Mark value → adjusted toggle shows estimated exit value"
        />
        <MetricTile
          title="Net P&L"
          rawValue={moneyText(overview.netPnl)}
          change={`Fees: ${moneyText({ status: 'KNOWN', usd: -overview.fees.totalUsd, confidence: 1 } as MonetaryValue)}`}
          changeType={overview.netPnl.usd !== null && overview.netPnl.usd >= 0 ? 'positive' : 'negative'}
          subtitle="Realized + unrealized, after all fees"
        />
        <MetricTile
          title="Portfolio Risk"
          rawValue={`${overview.riskScore} / 100`}
          badgeText={overview.riskBand}
          badgeVariant={riskBadgeVariant(overview.riskBand)}
          subtitle="Value-weighted, not a plain average"
        />
        <MetricTile
          title="Positions"
          rawValue={`${overview.openPositionCount} open`}
          change={`${overview.highRiskPositionCount} high-risk`}
          changeType={overview.highRiskPositionCount > 0 ? 'negative' : 'neutral'}
          subtitle={`${overview.pendingCount} pending · ${overview.exitabilityIssueCount} exitability issue(s)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryChip
          label="Largest exposure"
          value={
            overview.exposureSummary.largestToken
              ? `${overview.exposureSummary.largestToken.symbol} — ${(overview.exposureSummary.largestToken.sharePct * 100).toFixed(0)}%`
              : 'Unavailable'
          }
          icon={PieChart}
        />
        <SummaryChip
          label="Lowest exitability"
          value={
            overview.exposureSummary.lowestExitability
              ? `${overview.exposureSummary.lowestExitability.symbol} — ${overview.exposureSummary.lowestExitability.score}`
              : 'Unavailable'
          }
          icon={TrendingDown}
        />
        <SummaryChip
          label="Highest risk"
          value={
            overview.exposureSummary.highestRisk
              ? `${overview.exposureSummary.highestRisk.symbol} — ${overview.exposureSummary.highestRisk.score.toFixed(0)}`
              : 'Unavailable'
          }
          icon={ShieldAlert}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What changed" subtitle="Comparative observations, not trade instructions">
          {changes.length === 0 ? (
            <p className="text-xs text-slate-500">No material changes since the last snapshot.</p>
          ) : (
            <ul className="space-y-2">
              {changes.slice(0, 6).map((change, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {change.severity === 'critical' ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-400 mt-0.5 shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-slate-200 font-medium">{change.title}</p>
                    <p className="text-slate-500">{change.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={risk.headline} subtitle="Primary drivers, weighted by value and liquidity">
          {risk.drivers.length === 0 ? (
            <p className="text-xs text-slate-500">No single factor dominates this portfolio's risk.</p>
          ) : (
            <ul className="space-y-2">
              {risk.portfolioRisk.drivers.map((driver: PortfolioRiskDriver) => (
                <li key={driver.key} className="text-xs border-l-2 border-sky-500/50 pl-3 py-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-semibold">{driver.label}</span>
                    <span className="font-mono text-slate-400">+{driver.contribution.toFixed(1)}</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">{driver.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Positions"
        padding="none"
        headerActions={
          <div className="flex items-center gap-1.5">
            {(['VALUE', 'PNL', 'RISK', 'ALLOCATION', 'EXITABILITY'] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-2 py-1 rounded text-2xs font-mono uppercase transition-colors ${
                  sort === key
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 border border-transparent hover:text-slate-200'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        }
      >
        <DataTable columns={columns} data={positions} keyExtractor={(p) => p.id} isLoading={loading} />
      </Panel>

      {overview.limitations.length > 0 && (
        <Panel variant="subtle" title="Known limitations">
          <ul className="text-2xs text-slate-500 space-y-1 list-disc list-inside">
            {overview.limitations.slice(0, 8).map((limitation, i) => (
              <li key={i}>{limitation}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sentinel-700/80 bg-sentinel-850/80 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sentinel-800 text-sky-400 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-100 truncate">{value}</p>
      </div>
    </div>
  );
}
