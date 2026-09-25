'use client';

import React from 'react';
import { Users, ChefHat, Target, Ghost, Boxes } from 'lucide-react';
import { clsx } from 'clsx';
import { LegendTooltip } from '@/components/ui/legend-tooltip';
import { MetricValue } from '@/components/ui/metric-value';
import { toValueState } from '@/lib/ui/value-state';
import type { MetricEvidence } from '@/lib/discovery/types';
import { currentEvidence } from '@/lib/discovery/audit-freshness';
import { useEvidenceClock } from '@/lib/hooks/use-evidence-clock';
import { formatDisplaySource } from '@/lib/discovery/format';

/**
 * The ownership audit row, in one place.
 *
 * ## Why this is shared
 *
 * The thresholds and colour bands were written out twice — once in
 * `components/discovery/token-card.tsx` and again in
 * `components/ui/token-card.tsx` — and the copies had already drifted: the
 * Overview card omitted Insiders entirely, had no pending state, and hid the
 * whole row unless one of three specific fields happened to be present. Two
 * cards showing the same token off the same endpoint disagreed about what had
 * been measured.
 *
 * ## What the bands mean
 *
 * A red pill is a reason to look closer, not a verdict. The cut-offs are
 * deliberately conservative and identical across every surface, so a token
 * cannot read as safe in one column and risky in another.
 *
 * Unknown renders neutral grey, never green. That distinction is the whole
 * point: for a long time every one of these was a hardcoded constant that
 * happened to fall inside its own "safe" band, so the entire feed advertised a
 * clean audit that nothing had performed.
 */

export interface AuditPillsProps {
  top10HoldingsPct?: number;
  devHoldingsPct?: number;
  devWalletAge?: string;
  sniperPercentage?: number;
  insiderHoldingsPct?: number;
  bundlerPercentage?: number;
  /** True while a lookup is queued, so unknown can be told from unmeasured. */
  pending?: boolean;
  evidence?: MetricEvidence;
  evidenceByMetric?: Partial<Record<'top10' | 'dev', MetricEvidence>>;
  /** Render even when nothing is known, to hold layout on a feed. */
  alwaysShow?: boolean;
  className?: string;
}

interface PillSpec {
  key: string;
  label: string;
  definition: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | undefined;
  /** Above this, the pill is red. */
  danger: number;
  /** Above this (but below danger), amber. */
  warn: number;
}

const NEUTRAL = 'bg-slate-900/80 border-slate-800 text-slate-400';
const DANGER = 'bg-rose-950/60 border-rose-800/80 text-rose-400';
const WARN = 'bg-amber-950/50 border-amber-800/70 text-amber-400';
const SAFE = 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400';

export function AuditPills({
  top10HoldingsPct,
  devHoldingsPct,
  devWalletAge,
  sniperPercentage,
  insiderHoldingsPct,
  bundlerPercentage,
  pending = false,
  evidence,
  evidenceByMetric,
  alwaysShow = false,
  className = '',
}: AuditPillsProps) {
  const now = useEvidenceClock(evidence, evidenceByMetric?.top10, evidenceByMetric?.dev);
  const ageOf = (resolvedEvidence: MetricEvidence) => {
    if (!resolvedEvidence?.observedAt) return null;
    const ageMs = Date.now() - Date.parse(resolvedEvidence.observedAt);
    if (!Number.isFinite(ageMs)) return resolvedEvidence.observedAt;
    if (ageMs < 60_000) return `${Math.max(0, Math.floor(ageMs / 1_000))}s ago`;
    if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`;
    return `${Math.floor(ageMs / 3_600_000)}h ago`;
  };
  const pills: PillSpec[] = [
    {
      key: 'top10',
      label: 'Top 10 Holders %',
      definition:
        'Share of supply held by the largest 10 wallets. A high figure means a handful of holders can end the token at will.',
      icon: Users,
      value: top10HoldingsPct,
      warn: 30,
      danger: 60,
    },
    {
      key: 'dev',
      label: 'Dev Holding %',
      definition:
        "Share still held by the deployer wallet, plus how long ago that wallet was funded.",
      icon: ChefHat,
      value: devHoldingsPct,
      warn: 5,
      danger: 20,
    },
    {
      key: 'snipers',
      label: 'Snipers %',
      definition: 'Share bought by bots in the first blocks after launch.',
      icon: Target,
      value: sniperPercentage,
      warn: 5,
      danger: 10,
    },
    {
      key: 'insiders',
      label: 'Insiders %',
      definition: 'Share held by wallets linked to the deployer before launch.',
      icon: Ghost,
      value: insiderHoldingsPct,
      warn: 5,
      danger: 15,
    },
    {
      key: 'bundlers',
      label: 'Bundlers %',
      definition:
        'Share bought in the same block as pool creation — one operator across many wallets in a single bundle.',
      icon: Boxes,
      value: bundlerPercentage,
      warn: 5,
      danger: 20,
    },
  ];

  const anyKnown = pills.some((pill) => pill.value !== undefined);
  if (!anyKnown && !pending && !alwaysShow) return null;

  return (
    <div className={`flex items-center gap-1 flex-wrap text-2xs font-mono ${className}`}>
      {pills.map((pill) => {
        const resolvedEvidence = currentEvidence(evidenceByMetric?.[pill.key as 'top10' | 'dev'] ?? evidence, now);
        const evidenceAge = ageOf(resolvedEvidence);
        const state = toValueState(pill.value ?? null, {
          isPending: pill.value === undefined && (pending || resolvedEvidence.status === 'loading'),
          isStale: resolvedEvidence.status !== 'measured' && pill.value !== undefined,
        });
        const tone =
          state.kind !== 'value'
            ? NEUTRAL
            : state.value > pill.danger
              ? DANGER
              : state.value > pill.warn
                ? WARN
                : SAFE;
        const Icon = pill.icon;

        const badgeLabel =
          state.kind === 'value'
            ? `${Math.round(state.value)}%`
            : resolvedEvidence?.status
            ? resolvedEvidence.status.toUpperCase()
            : undefined;

        return (
          <LegendTooltip
            key={pill.key}
            label={pill.label}
            badge={badgeLabel}
            definition={
              <div className="space-y-2 text-left font-sans">
                <p className="text-[11px] leading-relaxed text-slate-200 font-normal">
                  {pill.definition}
                </p>

                <div className="flex items-center gap-2 text-[10px] font-mono bg-slate-900/90 rounded px-2 py-1 border border-slate-800">
                  <span className="text-amber-400 font-medium">Caution: &gt;{pill.warn}%</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-rose-400 font-medium">High Risk: &gt;{pill.danger}%</span>
                </div>

                {resolvedEvidence ? (
                  <div className="rounded border border-slate-800 bg-slate-950/80 p-2 space-y-1 text-[10px] font-mono">
                    <div className="flex items-center justify-between gap-1 text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="text-slate-500">Source:</span>
                        <span className="text-slate-200 font-semibold">{formatDisplaySource(resolvedEvidence.source)}</span>
                      </span>
                      <span
                        className={clsx(
                          'px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border',
                          resolvedEvidence.status === 'measured'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                            : resolvedEvidence.status === 'stale'
                            ? 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                            : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                        )}
                      >
                        {resolvedEvidence.status}
                      </span>
                    </div>

                    {evidenceAge && (
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="text-slate-500">Observed:</span>
                        <span className="text-slate-300">{evidenceAge}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 italic">
                    Metric not yet available.
                  </div>
                )}
              </div>
            }
          >
            <span
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border font-bold leading-none tabular-nums ${tone} ${resolvedEvidence?.status === 'stale' ? 'border-dashed opacity-80' : ''}`}
            >
              <Icon className="w-2.5 h-2.5" />
              <MetricValue
                state={state}
                label={pill.label}
                format={(value) => `${Math.round(value)}%`}
              />
              {pill.key === 'dev' && devWalletAge && (
                <span className="text-slate-400 font-normal">{devWalletAge}</span>
              )}
            </span>
          </LegendTooltip>
        );
      })}
    </div>
  );
}
