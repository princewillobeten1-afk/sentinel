import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';
import type { TokenCardFields } from '@/lib/market/live/card-cache';
import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import { currentEvidence } from '@/lib/discovery/audit-freshness';

export interface JupiterAuditToken {
  id?: string;
  symbol?: string;
  dev?: string;
  organicScore?: number;
  organicScoreLabel?: string;
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
    devBalancePercentage?: number;
    devMints?: number;
    devMigrations?: number;
  };
}

export interface TokenAudit {
  token: string;
  chain: string;
  symbol: string | null;
  creatorAddress: string | null;
  mintAuthorityDisabled: boolean | null;
  freezeAuthorityDisabled: boolean | null;
  lpTokensBurned: boolean | null;
  liquidityLocked: boolean | null;
  honeypotTaxZero: boolean | null;
  top10HoldersPct: number | null;
  devBalancePct: number | null;
  organicScore: number | null;
  organicScoreLabel: string | null;
  devMints: number | null;
  devMigrations: number | null;
  migrationRatePct: number | null;
  snipersPct: number | null;
  insidersPct: number | null;
  bundlersPct: number | null;
  holderTop10Pct: number | null;
  totalHolders: number | null;
  holderAuditPending: boolean;
  rugRisk: RugRiskEvidence | null;
  auditVersion: string | null;
  marketEvidence: MetricEvidence;
  ownershipEvidence: MetricEvidence;
  securityEvidence: MetricEvidence;
  creatorEvidence: MetricEvidence;
  lifecycleEvidence: MetricEvidence;
  liquidityEvidence: MetricEvidence;
  top10Evidence: MetricEvidence;
  devBalanceEvidence: MetricEvidence;
  mintAuthorityEvidence: MetricEvidence;
  freezeAuthorityEvidence: MetricEvidence;
  organicEvidence: MetricEvidence;
  historyEvidence: MetricEvidence;
  coverage: string;
  lastAuditedAt: string | null;
}

const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const percent = (value: unknown) => number(value) !== null && (value as number) <= 100 ? value as number : null;
const boolean = (value: unknown) => typeof value === 'boolean' ? value : null;

/** Reject malformed payloads before rendering numbers or scoring labels. */
export function isTokenAudit(value: unknown, mint: string): value is TokenAudit {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (data.token !== mint || data.chain !== 'solana' || typeof data.holderAuditPending !== 'boolean') return false;
  const numeric = ['top10HoldersPct', 'devBalancePct', 'organicScore', 'devMints', 'devMigrations',
    'migrationRatePct', 'snipersPct', 'insidersPct', 'bundlersPct', 'holderTop10Pct', 'totalHolders'];
  if (!numeric.every(key => data[key] === null || number(data[key]) !== null)) return false;
  if (!['mintAuthorityDisabled', 'freezeAuthorityDisabled', 'lpTokensBurned', 'honeypotTaxZero']
    .every(key => data[key] === null || typeof data[key] === 'boolean')) return false;
  for (const key of ['ownershipEvidence', 'securityEvidence', 'liquidityEvidence', 'creatorEvidence', 'marketEvidence',
    'lifecycleEvidence', 'top10Evidence', 'devBalanceEvidence', 'mintAuthorityEvidence', 'freezeAuthorityEvidence', 'organicEvidence', 'historyEvidence']) {
    const group = data[key] as MetricEvidence | null | undefined;
    if (group != null && (typeof group !== 'object' || !['measured', 'stale', 'loading', 'unavailable'].includes(group.status)
      || typeof group.source !== 'string' || typeof group.observedAt !== 'string'
      || group.expiresAt !== undefined && typeof group.expiresAt !== 'string'
      || group.reason !== undefined && typeof group.reason !== 'string')) return false;
  }
  const risk = data.rugRisk as RugRiskEvidence | null;
  return !risk || typeof risk.score === 'number' && Number.isFinite(risk.score) && Array.isArray(risk.factors)
    && risk.factors.every(factor => typeof factor === 'string') && ['low', 'medium', 'high', 'critical'].includes(risk.level);
}

/** Compose every response from current workers; only the Jupiter response is cached. */
export function composeTokenAudit(mint: string, live: TokenCardFields | undefined, holder: HolderProfile | null,
  jupiter: JupiterAuditToken | null, jupiterEvidence: MetricEvidence, pending: boolean, now = Date.now()): TokenAudit {
  const audit = jupiter?.audit;
  const source = currentEvidence(jupiterEvidence, now);
  const holderEvidence: MetricEvidence | undefined = holder ? {
    status: [holder.top10Pct, holder.devPct, holder.snipersPct, holder.insidersPct, holder.bundlersPct,
      holder.totalHolders, holder.proTraders, holder.kols].every(value => value !== null) ? 'measured' : 'unavailable',
    source: 'birdeye-holder-profile', observedAt: new Date(holder.fetchedAt).toISOString(),
    expiresAt: new Date(holder.fetchedAt + (live?.lifecycleState === 'migrated' ? 180_000 : 60_000)).toISOString(),
  } : undefined;
  const ownershipEvidence = currentEvidence(live?.ownershipEvidence ?? holderEvidence ?? (pending
    ? { status: 'loading', source: 'birdeye-holder-profile', observedAt: '' } : undefined), now);
  const securityEvidence = currentEvidence(live?.securityEvidence, now);
  const choose = <T,>(liveValue: T | null, fallback: T | null, evidence: MetricEvidence) => liveValue !== null
    ? { value: liveValue, evidence } : { value: fallback, evidence: fallback !== null ? source : currentEvidence() };
  const top10 = choose(percent(live?.top10HoldingsPct) ?? percent(holder?.top10Pct), percent(audit?.topHoldersPercentage), ownershipEvidence);
  const dev = choose(percent(live?.devHoldingsPct) ?? percent(holder?.devPct), percent(audit?.devBalancePercentage), ownershipEvidence);
  const mintAuthority = choose(boolean(live?.isMintRenounced), boolean(audit?.mintAuthorityDisabled), securityEvidence);
  const freezeAuthority = choose(boolean(live?.isFreezeDisabled), boolean(audit?.freezeAuthorityDisabled), securityEvidence);
  const devMints = number(audit?.devMints);
  const devMigrations = number(audit?.devMigrations);
  const hasJupiterMeasurements = [boolean(audit?.mintAuthorityDisabled), boolean(audit?.freezeAuthorityDisabled),
    percent(audit?.topHoldersPercentage), percent(audit?.devBalancePercentage), percent(jupiter?.organicScore), devMints, devMigrations]
    .some(value => value !== null);
  // A price/trade tick is not an audit observation; neither is a failed request.
  const observed = [ownershipEvidence, securityEvidence, currentEvidence(live?.liquidityEvidence, now), ...(hasJupiterMeasurements ? [source] : [])]
    .filter(group => group.status === 'measured' || group.status === 'stale')
    .map(group => Date.parse(group.observedAt)).filter(Number.isFinite);
  return {
    token: mint, chain: 'solana', symbol: jupiter?.symbol ?? null, creatorAddress: live?.devAddress ?? jupiter?.dev ?? null,
    mintAuthorityDisabled: mintAuthority.value, freezeAuthorityDisabled: freezeAuthority.value,
    lpTokensBurned: null, liquidityLocked: boolean(live?.isLiquidityLocked), honeypotTaxZero: null,
    top10HoldersPct: top10.value, devBalancePct: dev.value,
    organicScore: percent(jupiter?.organicScore), organicScoreLabel: jupiter?.organicScoreLabel ?? null,
    devMints, devMigrations, migrationRatePct: devMints && devMigrations !== null ? devMigrations / devMints * 100 : null,
    snipersPct: percent(live?.sniperPercentage) ?? percent(holder?.snipersPct),
    insidersPct: percent(live?.insiderHoldingsPct) ?? percent(holder?.insidersPct),
    bundlersPct: percent(live?.bundlerPercentage) ?? percent(holder?.bundlersPct),
    holderTop10Pct: percent(live?.top10HoldingsPct) ?? percent(holder?.top10Pct),
    totalHolders: number(live?.holdersCount) ?? number(holder?.totalHolders),
    holderAuditPending: pending,
    rugRisk: live?.rugRisk ?? null, auditVersion: live?.auditVersion ?? null,
    marketEvidence: currentEvidence(live?.marketEvidence, now), ownershipEvidence, securityEvidence,
    creatorEvidence: currentEvidence(live?.creatorEvidence, now), lifecycleEvidence: currentEvidence(live?.lifecycleEvidence, now),
    liquidityEvidence: currentEvidence(live?.liquidityEvidence, now),
    top10Evidence: top10.evidence, devBalanceEvidence: dev.evidence,
    mintAuthorityEvidence: mintAuthority.evidence, freezeAuthorityEvidence: freezeAuthority.evidence,
    organicEvidence: source, historyEvidence: source,
    coverage: 'Provider-backed ownership and authority evidence. LP-burn status and honeypot/tax behavior are not checked. Risk is an evidence-based estimate, not a safety guarantee.',
    lastAuditedAt: observed.length ? new Date(Math.max(...observed)).toISOString() : null,
  };
}
