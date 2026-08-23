'use client';

import React, { useEffect, useState } from 'react';
import { PieChart, AlertTriangle, ShieldAlert, Zap, ArrowDownToLine, ArrowUpFromLine, Shield } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { MetricTile } from '@/components/ui/metric-tile';
import { DataTable, Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PortfolioPosition, PortfolioSummary } from '@/lib/portfolio/pnl-types';
import type { Position as EnginePosition } from '@/lib/portfolio/types';
import { adaptPortfolioSummary, adaptPosition } from '@/lib/portfolio/view-adapter';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';
import { PositionProtectionModal } from '@/components/protection/position-protection-modal';
import { usePrimaryWallet, useWalletActions } from '@/lib/store';

export function PortfolioView() {
  const { address } = usePrimaryWallet();
  const { setWalletModalOpen } = useWalletActions();
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [selectedProtectionPosition, setSelectedProtectionPosition] = useState<PortfolioPosition | null>(null);
  // Only "loading" if there is a wallet to load for.
  const [isLoading, setIsLoading] = useState(Boolean(address));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [limitations, setLimitations] = useState<string[]>([]);

  /**
   * Reads the real portfolio engine via `/api/v1/portfolio/:wallet`.
   *
   * Previously pointed at `/api/portfolio`, an unversioned route that
   * synthesised a fake cost basis from live holdings and fell back to four
   * hardcoded demo tokens whenever Birdeye was unavailable — so the numbers on
   * screen were plausible-looking but not this user's. The v1 route runs the
   * reconciliation engine and enforces wallet ownership.
   *
   * That ownership check is why the wallet is a path segment, not an optional
   * query param: there is no "everyone's portfolio" reading to fall back on.
   */
  useEffect(() => {
    if (!address) {
      setPositions([]);
      setSummary(null);
      setLoadError(null);
      setIsLoading(false);
      return;
    }

    // A wallet switch mid-flight must not have its response applied after the
    // newer one — otherwise the view shows the previous wallet's holdings.
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    const readJson = async (res: Response, what: string) => {
      try {
        return await readApiData<any>(res, `Failed to load portfolio ${what}`);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) {
          throw new Error('Sign in to view your portfolio.');
        }
        throw err;
      }
    };

    Promise.all([
      fetch(apiUrl(endpoints.portfolio.overview(address)), { credentials: 'include' }).then((r) =>
        readJson(r, 'overview'),
      ),
      fetch(apiUrl(endpoints.portfolio.positions(address)), { credentials: 'include' }).then((r) =>
        readJson(r, 'positions'),
      ),
    ])
      .then(([overviewBody, positionsBody]) => {
        if (cancelled) return;
        const enginePositions: EnginePosition[] = positionsBody?.positions ?? [];
        const adapted = adaptPortfolioSummary(
          overviewBody.overview,
          enginePositions,
          overviewBody.limitations ?? [],
        );
        setSummary(adapted.summary);
        setLimitations(adapted.limitations);
        setPositions(enginePositions.map(adaptPosition));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLoadError(err.message);
        setSummary(null);
        setPositions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const defaultSummary: PortfolioSummary = {
    totalReportedValueUsd: 0,
    estimatedExecutableValueUsd: 0,
    trueNetPnlUsd: 0,
    realizedPnlUsd: 0,
    unrealizedPnlUsd: 0,
    knownCostsUsd: 0,
    concentrationRisk: 'LOW',
    liquidityHealth: 'GOOD',
    overallExitability: 0,
    insiderExposurePct: 0,
  };

  const activeSummary = summary || defaultSummary;

  // Checked BEFORE the spinner: with no wallet there is nothing to load, so the
  // spinner guard sitting above this meant the empty state could never paint on
  // first render and a signed-out user saw a spinner that resolved to nothing.
  // A portfolio is wallet-scoped, so with no wallet linked there is nothing to
  // read — say so and offer the action, rather than rendering a table of zeros
  // that looks like a real empty portfolio.
  if (!address) {
    return (
      <div className="p-12 text-center">
        <PieChart className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-100">No wallet connected</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Connect a wallet to see its positions, true net P&amp;L after costs, and exit risk.
        </p>
        <Button className="mt-5" onClick={() => setWalletModalOpen(true, 'deposit')}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (isLoading && !summary) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full mb-3" />
        <p>Loading Portfolio Intelligence...</p>
      </div>
    );
  }


  if (loadError) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-100">Portfolio unavailable</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">{loadError}</p>
      </div>
    );
  }

  const columns: Column<PortfolioPosition>[] = [
    {
      key: 'token',
      header: 'Asset Position',
      accessor: (item) => (
        <div>
          <p className="font-bold text-slate-100">{item.symbol || 'TOKEN'}</p>
          <p className="text-2xs text-slate-500 font-numeric">
            Holdings: {(item.quantity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      ),
    },
    {
      key: 'pnl',
      header: 'True Net P&L',
      isMonospace: true,
      align: 'right',
      accessor: (item) => {
        const net = item.trueNetPnlUsd ?? 0;
        const gross = item.grossPnlUsd ?? 0;
        return (
          <div>
            <p className={`font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {net >= 0 ? '+' : ''}${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-2xs text-slate-500">
              Gross: ${gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        );
      },
    },
    {
      key: 'execution',
      header: 'Known Costs',
      isMonospace: true,
      align: 'right',
      accessor: (item) => {
        const fees = item.totalFeesPaidUsd ?? 0;
        const gas = item.totalGasPaidUsd ?? 0;
        const slippage = item.totalSlippageUsd ?? 0;
        const total = fees + gas + slippage;
        return (
          <div>
            <p className="font-bold text-slate-300">
              ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-2xs text-slate-500">
              Gas: ${gas.toFixed(1)} | Slippage: ${slippage.toFixed(1)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'exitability',
      header: 'Exitability',
      align: 'center',
      accessor: (item) => {
        const score = item.exitabilityScore ?? 70;
        const execVal = item.estimatedExecutableValueUsd ?? 0;
        return (
          <div className="flex flex-col items-center gap-1">
            <Badge
              variant="outline"
              className={score > 60 ? 'text-emerald-400 border-emerald-400/50' : 'text-amber-400 border-amber-400/50'}
            >
              {score} / 100
            </Badge>
            <div className="text-2xs text-slate-400 whitespace-nowrap">
              Value: ${(execVal / 1000).toFixed(1)}K
            </div>
          </div>
        );
      },
    },
    {
      key: 'risk',
      header: 'Insider Risk',
      align: 'center',
      accessor: (item) => {
        let variant: any = 'neutral';
        if (item.insiderRisk === 'HIGH' || item.insiderRisk === 'CRITICAL') variant = 'destructive';
        if (item.insiderRisk === 'MEDIUM') variant = 'warning';
        if (item.insiderRisk === 'LOW') variant = 'success';

        return <Badge variant={variant}>{item.insiderRisk || 'LOW'}</Badge>;
      },
    },
    {
      key: 'protection',
      header: 'Stop Loss / TP',
      align: 'center',
      accessor: (item) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setSelectedProtectionPosition(item)}
          leftIcon={<Shield className="w-3 h-3 text-sky-400" />}
        >
          Manage Protection
        </Button>
      ),
    },
  ];

  const reportedVal = activeSummary.totalReportedValueUsd ?? 0;
  const execVal = activeSummary.estimatedExecutableValueUsd ?? 0;
  const netPnl = activeSummary.trueNetPnlUsd ?? 0;
  const costs = activeSummary.knownCostsUsd ?? 0;
  const exitScore = activeSummary.overallExitability ?? 0;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <PieChart className="h-5 w-5 sm:h-6 sm:w-6 text-sky-400" /> Portfolio Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Realized & unrealized returns calculated strictly after priority fees, DEX slippage, and gas expenses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setWalletModalOpen(true, 'deposit')}
            variant="outline"
            size="sm"
            leftIcon={<ArrowDownToLine className="h-4 w-4 text-emerald-400" />}
            className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40"
          >
            Deposit
          </Button>
          <Button
            onClick={() => setWalletModalOpen(true, 'withdraw')}
            variant="outline"
            size="sm"
            leftIcon={<ArrowUpFromLine className="h-4 w-4 text-rose-400" />}
            className="border-rose-500/30 text-rose-300 hover:bg-rose-950/40"
          >
            Withdraw
          </Button>
        </div>
      </div>

      {/* INTELLIGENCE ALERTS */}
      <div className="flex flex-col md:flex-row gap-3">
        {activeSummary.concentrationRisk === 'HIGH' && (
          <div className="flex-1 bg-rose-950/20 border border-rose-500/30 p-3 rounded-xl flex items-start gap-2.5 backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-300">High Concentration Risk</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">Your largest position represents over 50% of your portfolio value.</p>
            </div>
          </div>
        )}

        {activeSummary.liquidityHealth === 'POOR' && (
          <div className="flex-1 bg-amber-950/20 border border-amber-500/30 p-3 rounded-xl flex items-start gap-2.5 backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-300">Poor Exitability</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">Executable liquidity is significantly lower than reported portfolio value.</p>
            </div>
          </div>
        )}

        {(activeSummary.insiderExposurePct ?? 0) > 10 && (
          <div className="flex-1 bg-rose-950/20 border border-rose-500/30 p-3 rounded-xl flex items-start gap-2.5 backdrop-blur-md">
            <Zap className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-300">Insider Exposure</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {activeSummary.insiderExposurePct}% of your portfolio is in assets with high potential cluster risk.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* The engine reports what it could not determine — a missing price or an
          unreconciled position changes how the totals above should be read, so
          it is shown rather than silently folded into the numbers. */}
      {limitations.length > 0 && (
        <div className="bg-sentinel-900/60 border border-sentinel-700/60 rounded-xl p-3">
          <h4 className="label-micro mb-1.5">Data limitations</h4>
          <ul className="space-y-1">
            {limitations.slice(0, 4).map((note, i) => (
              <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                <span className="text-slate-600 mt-px">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          title="Total Reported Value"
          rawValue={`$${reportedVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          adjustedValue={`Exe: $${execVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          change="Market Cap Mirage"
          changeType="neutral"
          sparklineData={[50, 55, 65, 75, 85, 95]}
          subtitle="Theoretical vs Executable"
        />
        <MetricTile
          title="True Net P&L"
          rawValue={`${netPnl >= 0 ? '+' : ''}$${netPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          change={`Gross: +${(netPnl + costs).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          changeType={netPnl >= 0 ? 'positive' : 'negative'}
          sparklineData={[40, 50, 60, 70, 80]}
          subtitle="Net value after all costs"
        />
        <MetricTile
          title="Known Costs"
          rawValue={`$${costs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          change="Lost to chain"
          changeType="negative"
          sparklineData={[10, 15, 20, 25, 30]}
          subtitle="Fees, gas, and slippage"
        />
        <MetricTile
          title="Overall Exitability"
          rawValue={`${exitScore} / 100`}
          badgeText={exitScore > 60 ? 'SAFE' : 'AT RISK'}
          badgeVariant={exitScore > 60 ? 'success' : 'warning'}
          sparklineData={[20, 20, 20, 20]}
          subtitle="Portfolio liquidity health"
        />
      </div>

      <Panel title="Active Intelligence Positions" padding="none">
        <DataTable columns={columns} data={positions} keyExtractor={(p) => p.tokenId} />
      </Panel>

      {selectedProtectionPosition && (
        <PositionProtectionModal
          positionId={selectedProtectionPosition.tokenId}
          tokenSymbol={selectedProtectionPosition.symbol}
          entryPrice={0.035}
          currentPrice={0.0425}
          positionTokens={selectedProtectionPosition.quantity}
          onClose={() => setSelectedProtectionPosition(null)}
          onProtectionSaved={() => {
            // refresh
          }}
        />
      )}
    </div>
  );
}
