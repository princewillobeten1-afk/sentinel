'use client';

import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Zap, AlertTriangle, Settings2, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PositionProtection } from '@/lib/protection/types';

interface PositionProtectionCardProps {
  protection?: PositionProtection;
  onManageProtection: () => void;
  onEmergencyExit: () => void;
}

export function PositionProtectionCard({
  protection,
  onManageProtection,
  onEmergencyExit
}: PositionProtectionCardProps) {
  if (!protection || !protection.isActive) {
    return (
      <div className="rounded-xl border border-dashed border-sentinel-750 bg-sentinel-850/50 p-3.5 flex items-center justify-between gap-3 text-xs font-numeric">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>No Position Protection active for this token.</span>
        </div>
        <Button variant="outline" size="xs" onClick={onManageProtection}>
          Set Protection
        </Button>
      </div>
    );
  }

  const stopLoss = protection.stopLoss;
  const executedTps = protection.takeProfits.filter(tp => tp.status === 'EXECUTED').length;
  const totalTps = protection.takeProfits.length;

  return (
    <div className="rounded-xl border border-sentinel-750 bg-sentinel-850 p-4 space-y-3 font-numeric text-xs shadow-card">
      
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white">Position Protection Active</span>
          <span className="text-2xs font-mono uppercase bg-sentinel-750 text-sky-300 px-2 py-0.5 rounded border border-sentinel-600">
            {protection.protectionMode.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={onManageProtection} leftIcon={<Settings2 className="w-3.5 h-3.5" />}>
            Manage Strategy
          </Button>
        </div>
      </div>

      {/* Grid Status */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        
        {/* Stop Loss Info */}
        <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/10 space-y-1">
          <div className="flex items-center justify-between text-2xs text-slate-400">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <AlertTriangle className="w-3 h-3" /> Stop Loss
            </span>
            <span className="font-mono text-slate-300 uppercase text-2xs">{stopLoss?.type || 'NONE'}</span>
          </div>
          <p className="text-base font-bold font-mono text-rose-300">
            ${stopLoss?.stopPrice.toFixed(4) || 'Unset'}
          </p>
          <p className="text-2xs text-slate-400 font-mono">
            {stopLoss?.type === 'TRAILING' ? `Trail: ${stopLoss.trailPct}%` : `Portion: ${stopLoss?.portionPct}%`}
          </p>
        </div>

        {/* Take Profit Progression Info */}
        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10 space-y-1">
          <div className="flex items-center justify-between text-2xs text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Zap className="w-3 h-3" /> Take Profits
            </span>
            <span className="font-mono text-emerald-300 font-bold text-2xs">{executedTps}/{totalTps} Triggered</span>
          </div>
          
          <div className="pt-1 flex gap-1">
            {protection.takeProfits.map((tp) => (
              <div
                key={tp.level}
                className={`flex-1 h-2 rounded-full ${
                  tp.status === 'EXECUTED' ? 'bg-emerald-400 shadow-glow-buy' : 'bg-sentinel-800'
                }`}
                title={`TP${tp.level}: $${tp.targetPrice.toFixed(4)} (${tp.portionPct}%)`}
              />
            ))}
          </div>

          <div className="flex justify-between text-2xs text-slate-400 font-mono pt-0.5">
            <span>Next Target:</span>
            <span className="text-slate-200 font-bold">
              {protection.takeProfits.find(tp => tp.status === 'PENDING')
                ? `$${protection.takeProfits.find(tp => tp.status === 'PENDING')!.targetPrice.toFixed(4)}`
                : 'All Executed'}
            </span>
          </div>
        </div>

      </div>

      {/* Emergency Action Banner */}
      <div className="pt-1 flex justify-end">
        <Button
          variant="destructive"
          size="xs"
          onClick={onEmergencyExit}
          leftIcon={<Flame className="w-3 h-3" />}
        >
          Emergency Exit
        </Button>
      </div>

    </div>
  );
}
