'use client';

import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';
import { currentEvidence, rugRiskState } from '@/lib/discovery/audit-freshness';
import { useEvidenceClock } from '@/lib/hooks/use-evidence-clock';
import { LegendTooltip } from './legend-tooltip';

export function RugRiskPill({ risk, ownershipEvidence, securityEvidence, liquidityEvidence }: {
  risk?: RugRiskEvidence | null;
  ownershipEvidence?: MetricEvidence | null;
  securityEvidence?: MetricEvidence | null;
  liquidityEvidence?: MetricEvidence | null;
}) {
  const groups = [ownershipEvidence, securityEvidence, liquidityEvidence];
  const now = useEvidenceClock(...groups);
  if (!risk) return null;
  const state = rugRiskState(risk, groups, now);
  const tone = state !== 'measured' ? 'border-slate-700 bg-slate-900 text-slate-400'
    : risk.level === 'high' || risk.level === 'critical' ? 'border-rose-800 bg-rose-950/60 text-rose-400'
    : risk.level === 'medium' ? 'border-amber-800 bg-amber-950/50 text-amber-400'
    : 'border-emerald-800 bg-emerald-950/60 text-emerald-400';
  const provenance = groups.map((group, i) => {
    const resolved = currentEvidence(group, now);
    return `${['Ownership', 'Authorities', 'Liquidity'][i]}: ${resolved.status}, ${resolved.source}${resolved.observedAt ? `, observed ${resolved.observedAt}` : ''}${resolved.reason ? ` (${resolved.reason})` : ''}`;
  }).join('. ');
  return <LegendTooltip label="Rug risk evidence" definition={`${state === 'measured' ? 'Current evidence' : `${state} evidence — not a current risk assessment`}. ${risk.factors.join('; ') || 'No elevated factors in the measured inputs'}. ${provenance}. Model ${risk.version}. Not a safety guarantee.`}>
    <span className={`self-start whitespace-nowrap rounded-full border px-1 py-0.5 font-sans text-[9px] font-medium ${tone}`}>
      Risk {risk.score}{state !== 'measured' ? ` · ${state}` : ` · ${risk.level}`}
    </span>
  </LegendTooltip>;
}
