'use client';

import React from 'react';
import { Lock, ShieldCheck, Snowflake } from 'lucide-react';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import type { MetricEvidence } from '@/lib/discovery/types';
import { currentEvidence } from '@/lib/discovery/audit-freshness';
import { useEvidenceClock } from '@/lib/hooks/use-evidence-clock';
import { formatDisplaySource } from '@/lib/discovery/format';

export interface SecurityPillsProps {
  isMintRenounced?: boolean;
  isFreezeDisabled?: boolean;
  isLiquidityLocked?: boolean;
  lpLockedPct?: number | null;
  evidence?: MetricEvidence;
  lpEvidence?: MetricEvidence;
  className?: string;
  compact?: boolean;
}

function SecurityPill({ label, value, evidence, icon: Icon, compact = false, displayValue }: {
  label: string;
  value: boolean | undefined;
  evidence?: MetricEvidence;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
  displayValue?: string;
}) {
  const now = useEvidenceClock(evidence);
  const resolvedEvidence = currentEvidence(evidence, now);
  const loading = resolvedEvidence?.status === 'loading';
  const stale = resolvedEvidence?.status === 'stale' || (resolvedEvidence?.status === 'unavailable' && value !== undefined);
  const text = loading ? '…' : displayValue ?? (value === undefined ? 'n/a' : value ? 'yes' : 'no');
  const tone = value === undefined || loading || stale
    ? 'border-slate-700 bg-slate-900 text-slate-500'
    : value
      ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
      : 'border-rose-800 bg-rose-950/60 text-rose-400';
  const provenance = resolvedEvidence
    ? `Source: ${formatDisplaySource(resolvedEvidence.source)}. ${resolvedEvidence.status}${resolvedEvidence.observedAt ? `, observed ${resolvedEvidence.observedAt}` : ''}`
    : 'Fact has not been verified yet.';

  return (
    <LegendTooltip label={label} definition={`${label} is an observed contract or pool fact, not a safety guarantee. ${provenance}`}>
      <span className={`flex items-center gap-1 rounded-full border ${compact ? 'px-1' : 'px-1.5'} py-0.5 text-[9px] font-bold ${tone} ${stale ? 'border-dashed opacity-80' : ''}`}>
        {!compact && <Icon className="h-2.5 w-2.5" />}
        <span aria-label={`${label}: ${text}`}>{compact ? `${label.replace(' off', '').replace(' locked', '')} ${loading ? '…' : displayValue ?? (value === undefined ? '—' : value ? '✓' : '×')}` : `${label} ${text}`}</span>
      </span>
    </LegendTooltip>
  );
}

export function SecurityPills({
  isMintRenounced,
  isFreezeDisabled,
  isLiquidityLocked,
  lpLockedPct,
  evidence,
  lpEvidence,
  className = '',
  compact = false,
}: SecurityPillsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <SecurityPill label="Mint off" value={isMintRenounced} evidence={evidence} icon={ShieldCheck} compact={compact} />
      <SecurityPill label="Freeze off" value={isFreezeDisabled} evidence={evidence} icon={Snowflake} compact={compact} />
      <SecurityPill label="LP locked" value={isLiquidityLocked} evidence={lpEvidence ?? evidence} icon={Lock} compact={compact} displayValue={typeof lpLockedPct === 'number' && Number.isFinite(lpLockedPct) ? `${lpLockedPct.toFixed(lpLockedPct < 1 ? 1 : 0)}%` : undefined} />
    </div>
  );
}
