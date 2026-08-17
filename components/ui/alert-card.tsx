import React from 'react';
import { clsx } from 'clsx';
import { ShieldAlert, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface AlertCardData {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  tokenSymbol: string;
  tokenName: string;
  description: string;
  evidence: string;
  actionText?: string;
}

export interface AlertCardProps {
  alert: AlertCardData;
  onAction?: () => void;
  className?: string;
}

export function AlertCard({ alert, onAction, className }: AlertCardProps) {
  const { type, severity, timestamp, tokenSymbol, tokenName, description, evidence, actionText = 'Inspect Risk Evidence' } = alert;

  const isCritical = severity === 'critical';
  const isHigh = severity === 'high';

  return (
    <div
      className={clsx(
        'rounded-xl border p-4 shadow-card transition-all space-y-3',
        isCritical
          ? 'border-rose-500/40 bg-rose-950/20'
          : isHigh
          ? 'border-amber-500/40 bg-amber-950/20'
          : 'border-sentinel-700/80 bg-sentinel-850',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          )}
          <span className="font-bold text-slate-100 text-xs">{type}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-2xs">
          <span className="text-slate-400">{timestamp}</span>
          <Badge variant={isCritical ? 'risk-critical' : isHigh ? 'risk-high' : 'risk-med'} size="sm">
            {severity}
          </Badge>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-sky-300 font-mono">{tokenName} ({tokenSymbol})</p>
        <p className="text-xs text-slate-200 mt-1 leading-relaxed">{description}</p>
      </div>

      <div className="rounded-lg bg-sentinel-950/80 p-2.5 border border-sentinel-800 text-2xs font-mono text-slate-300">
        <span className="text-2xs text-slate-500 uppercase block">Evidence</span>
        <p className="mt-0.5">{evidence}</p>
      </div>

      {onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          size="xs"
          className="w-full justify-between"
          rightIcon={<ArrowRight className="h-3 w-3" />}
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
