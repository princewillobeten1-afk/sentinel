'use client';

import React from 'react';
import {
  Users,
  Activity,
  DollarSign,
  Layers,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Server,
  Zap,
} from 'lucide-react';
import { MetricTile } from '@/components/ui/metric-tile';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { SystemServiceHealth, OperationsFeedEvent } from '@/lib/admin/types';

interface AdminOverviewTabProps {
  kpis: {
    totalUsers: number;
    activeTraders24h: number;
    volume24hUsd: number;
    trades24h: number;
    newTokens24h: number;
    activeAlertsCount: number;
    openIncidentsCount: number;
  };
  services: SystemServiceHealth[];
  alerts: Array<{ id: string; level: string; headline: string; description: string; timestamp: string }>;
  feed: OperationsFeedEvent[];
  onSelectEntity: (type: any, id: string) => void;
}

export function AdminOverviewTab({
  kpis,
  services,
  alerts,
  feed,
  onSelectEntity,
}: AdminOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Critical Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
              Active System & Risk Alerts ({alerts.length})
            </h3>
            <span className="text-2xs text-slate-500">Auto-escalation active</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  alt.level === 'CRITICAL'
                    ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50 text-rose-200'
                    : alt.level === 'WARNING'
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 text-amber-200'
                    : 'bg-sky-500/10 border-sky-500/30 hover:border-sky-500/50 text-sky-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge
                    variant={alt.level === 'CRITICAL' ? 'danger' : alt.level === 'WARNING' ? 'warning' : 'info'}
                    size="sm"
                    className="font-mono text-2xs"
                  >
                    {alt.level}
                  </Badge>
                  <span className="text-2xs text-slate-400 flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {alt.timestamp}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">{alt.headline}</h4>
                <p className="text-2xs text-slate-300 line-clamp-2">{alt.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Platform KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile
          title="Total Users"
          value={kpis.totalUsers.toLocaleString()}
          change="+342 today"
          isPositive={true}
          icon={Users}
        />
        <MetricTile
          title="Active Traders"
          value={kpis.activeTraders24h.toLocaleString()}
          change="+8.4%"
          isPositive={true}
          icon={Activity}
        />
        <MetricTile
          title="24h DEX Volume"
          value={`$${(kpis.volume24hUsd / 1_000_000).toFixed(1)}M`}
          change="+14.2%"
          isPositive={true}
          icon={DollarSign}
        />
        <MetricTile
          title="24h Trades"
          value={kpis.trades24h.toLocaleString()}
          change="+18.5%"
          isPositive={true}
          icon={TrendingUp}
        />
        <MetricTile
          title="New Tokens (24h)"
          value={kpis.newTokens24h.toLocaleString()}
          change="+128 indexed"
          isPositive={true}
          icon={Layers}
        />
        <MetricTile
          title="Open Incidents"
          value={kpis.openIncidentsCount.toString()}
          change="1 P1 / 1 P2"
          isPositive={kpis.openIncidentsCount === 0}
          icon={ShieldAlert}
        />
      </div>

      {/* 3. Core System Health Matrix & Real-Time Operations Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subsystem Health Matrix */}
        <Panel className="lg:col-span-1 p-4 bg-sentinel-900/50 border-white/5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white">System Subsystems</h3>
            </div>
            <Badge variant="success" size="sm">
              ALL OPERATIONAL
            </Badge>
          </div>

          <div className="space-y-2.5">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{svc.name}</p>
                    <p className="text-2xs text-slate-500 font-mono">
                      Latency: <span className="text-sky-400">{svc.latencyMs}ms</span> • Uptime: {svc.uptimePct}%
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            ))}
          </div>
        </Panel>

        {/* Real-Time Live Operations Feed */}
        <Panel className="lg:col-span-2 p-4 bg-sentinel-900/50 border-white/5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white">Real-Time Operations Feed</h3>
            </div>
            <span className="text-2xs text-slate-500 font-mono">Streaming 24/7 telemetry</span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[340px] pr-1 no-scrollbar">
            {feed.map((evt) => (
              <div
                key={evt.id}
                onClick={() => evt.entityLink && onSelectEntity(evt.entityLink.type, evt.entityLink.id)}
                className={`p-3 rounded-xl border bg-white/[0.02] border-white/5 hover:border-sky-500/30 transition flex items-start justify-between gap-3 ${
                  evt.entityLink ? 'cursor-pointer group' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-slate-500">{evt.timestamp}</span>
                    <Badge
                      variant={
                        evt.severity === 'CRITICAL'
                          ? 'danger'
                          : evt.severity === 'WARNING'
                          ? 'warning'
                          : evt.category === 'LAUNCHPAD'
                          ? 'info'
                          : 'neutral'
                      }
                      size="sm"
                      className="text-2xs font-mono"
                    >
                      {evt.category}
                    </Badge>
                    <h5 className="text-xs font-bold text-slate-200 group-hover:text-sky-300 transition">
                      {evt.headline}
                    </h5>
                  </div>
                  <p className="text-2xs text-slate-400">{evt.details}</p>
                </div>

                {evt.entityLink && (
                  <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
