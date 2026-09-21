import type { RugRiskEvidence } from '@/lib/discovery/types';

export const RUG_RISK_VERSION = 'ownership-v2';

export interface RugRiskInputs {
  top10Pct?: number | null;
  devPct?: number | null;
  snipersPct?: number | null;
  insidersPct?: number | null;
  bundlersPct?: number | null;
  mintAuthorityRevoked?: boolean | null;
  freezeAuthorityRevoked?: boolean | null;
  liquidityLocked?: boolean | null;
}

/**
 * A deterministic evidence score, not a prediction that a token will rug.
 * Missing evidence contributes nothing and is called out by the UI via the
 * evidence status; callers must not invoke this with an entirely empty input.
 */
export function calculateRugRisk(input: RugRiskInputs): RugRiskEvidence | null {
  const percentages = [input.top10Pct, input.devPct, input.snipersPct, input.insidersPct, input.bundlersPct];
  const authorities = [input.mintAuthorityRevoked, input.freezeAuthorityRevoked, input.liquidityLocked];
  const validPct = (value: unknown): value is number => typeof value === 'number'
    && Number.isFinite(value) && value >= 0 && value <= 100;
  if (!percentages.some(validPct) && !authorities.some((value) => typeof value === 'boolean')) return null;

  let score = 0;
  const factors: string[] = [];
  const addPctRisk = (value: number | null | undefined, warning: number, critical: number, weight: number, label: string) => {
    if (!validPct(value)) return;
    if (value >= critical) {
      score += weight;
      factors.push(`${label} ${value.toFixed(1)}%`);
    } else if (value >= warning) {
      score += Math.round(weight / 2);
      factors.push(`${label} elevated at ${value.toFixed(1)}%`);
    }
  };

  addPctRisk(input.top10Pct, 35, 55, 25, 'Top 10 ownership');
  addPctRisk(input.devPct, 5, 12, 25, 'Developer ownership');
  addPctRisk(input.insidersPct, 5, 15, 20, 'Insider ownership');
  addPctRisk(input.bundlersPct, 5, 15, 15, 'Bundled ownership');
  addPctRisk(input.snipersPct, 10, 25, 10, 'Sniper ownership');

  if (input.mintAuthorityRevoked === false) { score += 20; factors.push('Mint authority active'); }
  if (input.freezeAuthorityRevoked === false) { score += 15; factors.push('Freeze authority active'); }
  if (input.liquidityLocked === false) { score += 15; factors.push('Liquidity not verified as locked'); }

  score = Math.min(100, score);
  const level = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  const completeness = percentages.every(validPct) && authorities.every((value) => typeof value === 'boolean')
    ? 'complete'
    : 'partial';
  return { score, level, factors, version: RUG_RISK_VERSION, completeness };
}
