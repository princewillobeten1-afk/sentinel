import 'server-only';
import { getTokenOverview } from '@/lib/api/birdeye/stats';
import { getLiveDiscoveryTokens } from '@/lib/discovery/live-solana-feed';
import type { DiscoveryToken, MetricEvidence } from '@/lib/discovery/types';
import { getTokenCardPatch, hydrateTokenCards } from '@/lib/market/live/card-cache';
import { ensureAudit, getAudit, isAuditPending } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import { composeTokenAudit } from '@/lib/trading/audit-model';
import { getChartHistory } from '@/lib/market/chart-history';
import type { ChartTimeframe } from '@/lib/market/chart-model';
import type { EvidenceFact, ToolResult } from './contracts';
import { fact, numeric, chartFacts, changedFacts } from './evidence';
import { saveObservation, priorObservation } from './repository';
import { skills, GUIDE, type SkillName } from './skills';
import { privacyViolation } from './privacy';

const unavailable: MetricEvidence = { status: 'unavailable', source: 'unavailable', observedAt: '' };
async function assess(mint: string, signal: AbortSignal): Promise<ToolResult> {
  signal.throwIfAborted();
  await hydrateTokenCards([mint]);
  const existing = getTokenCardPatch(mint);
  queueSecurityTarget(mint);
  await ensureAudit(mint, existing?.changedFields.devAddress);
  signal.throwIfAborted();
  const patch = getTokenCardPatch(mint);
  const fields = patch?.changedFields;
  const audit = composeTokenAudit(mint, fields, getAudit(mint), null, unavailable, isAuditPending(mint));
  const facts: EvidenceFact[] = [];
  const provenance: Record<string, unknown> = { auditVersion: audit.auditVersion, ownership: audit.ownershipEvidence, security: audit.securityEvidence, creator: audit.creatorEvidence };
  const add = (metric: string, label: string, value: EvidenceFact['value'], category: EvidenceFact['category'], evidence: MetricEvidence, unit='') =>
    facts.push(fact({ mint, metric, label, value, unit, category }, evidence));
  let overview: Awaited<ReturnType<typeof getTokenOverview>> | undefined;
  // Existing live card snapshots are reused first; no second market stream is created.
  if (!fields?.marketEvidence || fields.marketEvidence.status !== 'measured') {
    try { const response = await getTokenOverview(mint); if (response?.address === mint) overview = response; } catch { /* Preserve missing evidence. */ }
  }
  signal.throwIfAborted();
  const fetched = new Date().toISOString();
  const snapshotEvidence: MetricEvidence = overview ? { status: 'measured', source: 'birdeye-overview', observedAt: fetched, expiresAt: new Date(Date.now()+30000).toISOString() } : fields?.marketEvidence ?? unavailable;
  provenance.market = snapshotEvidence;
  for (const [key, label, raw] of [
    ['priceUsd','Price',overview?.price ?? fields?.priceUsd], ['marketCapUsd','Market cap',overview?.marketCap ?? fields?.marketCapUsd],
    ['liquidityUsd','Liquidity',overview?.liquidity ?? fields?.liquidityUsd], ['volume24hUsd','Volume (24h)',overview?.v24hUSD ?? fields?.volume24hUsd],
  ] as const) {
    const evidence = overview ? snapshotEvidence : { ...snapshotEvidence, observedAt: patch?.fieldObservedAt?.[key] ?? snapshotEvidence.observedAt };
    add(key,label,numeric(raw),'market',evidence,'USD');
  }
  add('holders','Holders',audit.totalHolders,'ownership',audit.ownershipEvidence,'wallets');
  add('top10','Top ten concentration',audit.top10HoldersPct,'ownership',audit.top10Evidence,'%');
  add('dev','Developer holdings',audit.devBalancePct,'ownership',audit.devBalanceEvidence,'%');
  add('snipers','Classified sniper holdings',audit.snipersPct,'ownership',audit.ownershipEvidence,'%');
  add('insiders','Classified insider holdings',audit.insidersPct,'ownership',audit.ownershipEvidence,'%');
  add('bundlers','Classified bundled holdings',audit.bundlersPct,'ownership',audit.ownershipEvidence,'%');
  add('mintRevoked','Mint authority revoked',audit.mintAuthorityDisabled,'security',audit.mintAuthorityEvidence);
  add('freezeRevoked','Freeze authority revoked',audit.freezeAuthorityDisabled,'security',audit.freezeAuthorityEvidence);
  add('lpLocked','Liquidity locked',audit.liquidityLocked,'security',audit.liquidityEvidence);
  // A creator address alone is not evidence of a launch/rug count.
  add('creatorLaunches','Recorded creator launches',numeric(fields?.devMints),'creator',fields?.creatorEvidence ?? unavailable,'launches');
  add('creatorMigrations','Recorded creator migrations',numeric(fields?.devMigrations),'creator',fields?.creatorEvidence ?? unavailable,'migrations');
  await saveObservation(mint, facts, provenance);
  return { facts, notes: ['Ownership classifications are estimates, not proof of identity. Unknown or stale observations are not safety clearance.'] };
}

export function matchesMeasuredFilters(token: DiscoveryToken, args: Record<string, unknown>): boolean {
  const market = token.marketEvidence?.status === 'measured' && (!token.marketEvidence.expiresAt || Date.parse(token.marketEvidence.expiresAt)>Date.now());
  if (args.minLiquidity !== undefined && (!market || numeric(token.liquidityUsd) === null || Number(token.liquidityUsd)<Number(args.minLiquidity))) return false;
  const ownership = token.ownershipEvidence?.status === 'measured' && (!token.ownershipEvidence.expiresAt || Date.parse(token.ownershipEvidence.expiresAt)>Date.now());
  const thresholds = { maxTop10: token.top10HoldingsPct, maxDev: token.devHoldingsPct, maxSnipers: token.sniperPercentage, maxInsiders: token.insiderHoldingsPct, maxBundlers: token.bundlerPercentage };
  for (const [key,value] of Object.entries(thresholds)) if (args[key] !== undefined && (!ownership || numeric(value) === null || Number(value)>Number(args[key]))) return false;
  return args.maxAgeMinutes === undefined || Number.isFinite(token.ageMinutes) && token.ageMinutes <= Number(args.maxAgeMinutes);
}
export async function executeSkill(name: string, raw: unknown, signal: AbortSignal): Promise<ToolResult> {
  signal.throwIfAborted();
  if (!Object.prototype.hasOwnProperty.call(skills, name)) throw new Error('Tool is not allowed');
  const args = skills[name as SkillName].schema.parse(raw) as Record<string, any>;
  if (name === 'token_assessment') return assess(args.mint, signal);
  if (name === 'creator_analysis') { const result=await assess(args.mint,signal); return { facts: result.facts.filter(f=>f.category==='creator'), notes: ['Only recorded creator counts are available. Wallet relationships and rug history are not inferred.'] }; }
  if (name === 'chart_analysis') {
    const snapshot = await getChartHistory(args.mint, args.timeframe as ChartTimeframe, 100);
    signal.throwIfAborted();
    return { facts: chartFacts(snapshot), notes: ['Calculations use measured USD candles, not screen pixels or MCAP. Indicators require recent contiguous history.'] };
  }
  if (name === 'compare_tokens') {
    const results: ToolResult[]=[];
    for (const mint of [...new Set<string>(args.mints)]) results.push(await assess(mint,signal));
    return { facts: results.flatMap(r=>r.facts), notes: ['Market volumes use the same daily window. Compare freshness before interpreting differences.'] };
  }
  if (name === 'what_changed') {
    const previous=await priorObservation(args.mint,args.minutes);
    const current=await assess(args.mint,signal);
    // A row saved at the target time may itself contain old cached observations.
    const target=Date.now()-args.minutes*60000;
    const historical=previous.filter(f=>f.observedAt && Math.abs(Date.parse(f.observedAt)-target)<=5*60000);
    const deltas=changedFacts(current.facts,historical);
    return { facts: deltas.length ? deltas : current.facts, notes: [deltas.length ? 'Changes compare actual stored observations at the displayed times.' : 'Insufficient stored history for this interval. No earlier snapshot has been invented.'] };
  }
  if (name === 'discovery_search') {
    if (privacyViolation(args.query ?? '')) throw new Error('Public search terms only');
    const tokens = await getLiveDiscoveryTokens({ section: args.section, searchQuery: args.query });
    signal.throwIfAborted();
    const matching = tokens.filter(t=>matchesMeasuredFilters(t,args)).slice(0,5);
    const facts=matching.map(t=>fact({ mint:t.mint, metric:'discoveryMatch', label:'Matching token mint', value:t.mint, unit:'', category:'market' },
      { status:'measured', source:'live-discovery', observedAt:new Date().toISOString(), expiresAt:new Date(Date.now()+30000).toISOString() }));
    return { facts, candidates: matching.map(t=>t.mint), notes: ['Results cover the currently indexed feed, not every Solana token. Confirm the mint; names and symbols may collide.'] };
  }
  const at=new Date().toISOString();
  return { facts: [fact({ metric:'guide.'+args.topic,label:'Platform guide',value:GUIDE[args.topic],unit:'',category:'guide' },{status:'measured',source:'curated-guide-v1',observedAt:at})], notes: [] };
}
