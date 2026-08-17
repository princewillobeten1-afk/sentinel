'use client';

import React from 'react';
import {
  Server,
  Cpu,
  Database,
  Radio,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Activity,
  HardDrive,
  Globe,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { InfrastructureMetrics } from '@/lib/admin/types';

interface AdminInfrastructureTabProps {
  metrics: InfrastructureMetrics;
  blockchains: Array<{
    chain: string;
    name: string;
    currentBlock: number;
    blockLag: number;
    rpcLatencyMs: number;
    activeProviders: string[];
    reorgStatus: string;
    tps: number;
  }>;
}

export function AdminInfrastructureTab({ metrics, blockchains }: AdminInfrastructureTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Hardware Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-2xs font-mono uppercase">Cluster CPU Usage</span>
            <Cpu className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-xl font-bold text-white font-mono">{metrics.cpuUsagePct}%</p>
        </div>

        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-2xs font-mono uppercase">Cluster RAM Usage</span>
            <Server className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white font-mono">{metrics.memoryUsagePct}%</p>
        </div>

        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-2xs font-mono uppercase">Postgres Disk Usage</span>
            <HardDrive className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-white font-mono">{metrics.diskUsagePct}%</p>
        </div>

        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-2xs font-mono uppercase">Ingestion Queue Depth</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-sky-400 font-mono">{metrics.eventBusQueueDepth} evts</p>
        </div>
      </div>

      {/* 2. Multi-Chain RPC Telemetry & Reorg Monitor */}
      <Panel className="p-5 bg-sentinel-900/40 border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Multi-Chain Infrastructure & Reorg Telemetry</h3>
          </div>
          <Badge variant="success" size="sm" className="font-mono text-xs">
            0 Chain Reorgs
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {blockchains.map((bc) => (
            <div key={bc.chain} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{bc.name}</span>
                <Badge variant={bc.blockLag === 0 ? 'success' : 'warning'} size="sm" className="font-mono text-2xs">
                  {bc.blockLag === 0 ? 'SYNCED' : `${bc.blockLag} BLOCK LAG`}
                </Badge>
              </div>

              <div className="space-y-1 text-xs font-mono text-slate-400">
                <div className="flex justify-between">
                  <span className="text-slate-500">Block Height:</span>
                  <span className="text-slate-200">#{bc.currentBlock.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RPC Latency:</span>
                  <span className="text-sky-400">{bc.rpcLatencyMs}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Throughput:</span>
                  <span className="text-emerald-400">{bc.tps.toLocaleString()} TPS</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-2xs text-slate-500 block mb-1">Active RPC Providers:</span>
                <div className="space-y-0.5">
                  {bc.activeProviders.map((p, i) => (
                    <p key={i} className="text-2xs text-slate-400 truncate">
                      • {p}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
