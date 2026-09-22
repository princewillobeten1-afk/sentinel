import type { MetricEvidence, RugRiskEvidence } from './types';

/** Missing or malformed provenance must never make a cached number reassuring. */
export function currentEvidence(evidence?: MetricEvidence | null, now = Date.now()): MetricEvidence {
  if (!evidence) return { status: 'unavailable', source: 'unknown', observedAt: '', reason: 'No observation recorded.' };
  if (evidence.status !== 'measured') return evidence;
  if (!Number.isFinite(Date.parse(evidence.observedAt))) {
    return { ...evidence, status: 'unavailable', reason: 'Observation time is unavailable.' };
  }
  if (evidence.expiresAt && (!Number.isFinite(Date.parse(evidence.expiresAt)) || Date.parse(evidence.expiresAt) <= now)) {
    return { ...evidence, status: 'stale', reason: evidence.reason ?? 'Evidence has expired; awaiting a new observation.' };
  }
  return evidence;
}

export function rugRiskState(risk: RugRiskEvidence | null | undefined, groups: Array<MetricEvidence | null | undefined>, now = Date.now()) {
  const evidence = groups.map(group => currentEvidence(group, now));
  if (evidence.some(group => group.status === 'stale' || group.status === 'unavailable' && !!group.observedAt)) return 'stale';
  if (!risk || risk.completeness !== 'complete' || evidence.some(group => group.status !== 'measured')) return 'partial';
  return 'measured';
}

export function currentRiskRating(risk: RugRiskEvidence | null | undefined, groups: Array<MetricEvidence | null | undefined>) {
  return risk && rugRiskState(risk, groups) === 'measured'
    ? risk.level === 'medium' ? 'med' : risk.level
    : 'unknown';
}
