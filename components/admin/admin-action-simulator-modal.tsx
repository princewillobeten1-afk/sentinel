'use client';

import React from 'react';
import {
  Eye,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SimulationResult } from '@/lib/admin/types';

interface AdminActionSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulation: SimulationResult | null;
  onConfirmExecution?: () => void;
}

export function AdminActionSimulatorModal({
  isOpen,
  onClose,
  simulation,
  onConfirmExecution,
}: AdminActionSimulatorModalProps) {
  if (!simulation) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Administrative Action Simulator">
      <div className="space-y-5 max-w-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div>
            <Badge variant="info" size="sm" className="font-mono text-2xs mb-1">
              ACTION: {simulation.actionType}
            </Badge>
            <h3 className="text-sm font-bold text-white">{simulation.target}</h3>
          </div>
          <Badge
            variant={
              simulation.estimatedImpact.liquidityStressRisk === 'HIGH'
                ? 'danger'
                : simulation.estimatedImpact.liquidityStressRisk === 'MEDIUM'
                ? 'warning'
                : 'success'
            }
            size="sm"
          >
            LIQUIDITY RISK: {simulation.estimatedImpact.liquidityStressRisk}
          </Badge>
        </div>

        {/* Before vs After State Diff Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Current State
            </span>
            <pre className="text-xs text-slate-300 font-mono overflow-x-auto p-2 bg-black/40 rounded-lg">
              {JSON.stringify(simulation.currentState, null, 2)}
            </pre>
          </div>

          <div className="p-3.5 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-2">
            <span className="text-2xs font-bold text-sky-400 uppercase tracking-wider font-mono flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Proposed State
            </span>
            <pre className="text-xs text-sky-200 font-mono overflow-x-auto p-2 bg-black/40 rounded-lg">
              {JSON.stringify(simulation.proposedState, null, 2)}
            </pre>
          </div>
        </div>

        {/* Projected Impact Forecast Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-2xs text-slate-500 font-mono block">24h Revenue Diff</span>
            <span
              className={`text-sm font-bold font-mono ${
                simulation.estimatedImpact.revenueChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {simulation.estimatedImpact.revenueChangePct >= 0 ? '+' : ''}
              {simulation.estimatedImpact.revenueChangePct}%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-2xs text-slate-500 font-mono block">Volume Response</span>
            <span
              className={`text-sm font-bold font-mono ${
                simulation.estimatedImpact.volumeChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {simulation.estimatedImpact.volumeChangePct >= 0 ? '+' : ''}
              {simulation.estimatedImpact.volumeChangePct}%
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-2xs text-slate-500 font-mono block">Affected Traders</span>
            <span className="text-sm font-bold font-mono text-slate-200">
              ~{simulation.estimatedImpact.affectedUsersCount.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          {simulation.estimatedImpact.summary}
        </p>

        {/* Simulation Warnings */}
        {simulation.warnings.length > 0 && (
          <div className="space-y-1.5">
            {simulation.warnings.map((w, i) => (
              <div key={i} className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close Preview
          </Button>
          {onConfirmExecution && (
            <Button variant="primary" size="sm" onClick={onConfirmExecution}>
              Proceed with Execution
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
