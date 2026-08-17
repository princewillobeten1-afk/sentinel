'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Gauge } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { MetricTile } from '@/components/ui/metric-tile';
import { EmptyState } from '@/components/ui/empty-state';

interface UsageSummary {
  requestsToday: number;
  requestsThisMonth: number;
  averageLatencyMs: number;
  errorRate: number;
  rateLimitEvents: number;
}

interface EndpointUsage {
  route: string;
  requests: number;
  averageLatencyMs: number;
  errorRate: number;
}

export function UsagePanel() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [byEndpoint, setByEndpoint] = useState<EndpointUsage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/user/usage');
        const payload = await res.json();
        if (!res.ok || !payload.success) throw new Error(payload?.error?.message ?? 'Failed to load usage');
        if (cancelled) return;
        setSummary(payload.data.summary);
        setByEndpoint(payload.data.byEndpoint);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load usage');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile title="Requests today" rawValue={summary.requestsToday.toLocaleString()} />
          <MetricTile title="Requests this month" rawValue={summary.requestsThisMonth.toLocaleString()} />
          <MetricTile title="Avg. latency" rawValue={`${summary.averageLatencyMs}ms`} />
          <MetricTile
            title="Error rate"
            rawValue={`${(summary.errorRate * 100).toFixed(1)}%`}
            changeType={summary.errorRate > 0.05 ? 'negative' : 'neutral'}
            subtitle={summary.rateLimitEvents > 0 ? `${summary.rateLimitEvents} rate-limited` : undefined}
          />
        </div>
      )}

      <Panel
        title={
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-400" /> Usage by endpoint
          </span>
        }
        subtitle="Top 20 routes by traffic, this process (in-memory — resets on server restart)."
      >
        {byEndpoint === null && !error && <p className="text-xs text-slate-500">Loading…</p>}

        {byEndpoint !== null && byEndpoint.length === 0 && (
          <EmptyState
            icon={Activity}
            title="No traffic yet"
            description="Make a request with an API key or your session and it'll show up here."
          />
        )}

        {byEndpoint !== null && byEndpoint.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-sentinel-800">
                  <th className="pb-2 font-medium">Route</th>
                  <th className="pb-2 font-medium text-right">Requests</th>
                  <th className="pb-2 font-medium text-right">Avg. latency</th>
                  <th className="pb-2 font-medium text-right">Error rate</th>
                </tr>
              </thead>
              <tbody>
                {byEndpoint.map((row) => (
                  <tr key={row.route} className="border-b border-sentinel-900 last:border-0">
                    <td className="py-2 font-mono text-slate-300">{row.route}</td>
                    <td className="py-2 text-right text-slate-300 font-numeric">{row.requests.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-300 font-numeric">{row.averageLatencyMs}ms</td>
                    <td className={`py-2 text-right font-numeric ${row.errorRate > 0.05 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {(row.errorRate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
