import bs58 from 'bs58';
import type { MetricEvidence, EvidenceStatus } from '@/lib/discovery/types';
import type { TokenAudit, JupiterAuditToken } from '@/lib/trading/audit-model';
import type { JupiterToken } from '@/lib/discovery/jupiter-feed';
import type { TokenCardPatch, TokenCardFields } from '@/lib/market/live/card-cache';
import type { TokenOverview } from '@/lib/api/birdeye/stats';
import { sanitizeTokenName } from '@/lib/discovery/sanitize-name';

export type IntelligenceCategory = 'market' | 'ownership' | 'security' | 'creator';
export interface IntelligenceMetric {
  id: string; label: string; category: IntelligenceCategory;
  value: number | boolean | null; unit: 'USD' | '%' | 'count' | 'boolean';
  status: EvidenceStatus; observedAt: string | null;
}
export interface IntelligenceFinding {
  id: string; severity: 'attention' | 'observation'; title: string; description: string; evidenceIds: string[];
}
export interface LiveIntelligenceReport {
  schemaVersion: '2'; methodologyVersion: 'observed-evidence-v1'; generatedAt: string;
  token: { mint: string; chain: 'solana'; symbol: string; name: string; creator: string | null };
  metrics: IntelligenceMetric[]; findings: IntelligenceFinding[];
  coverage: { total: number; measured: number; stale: number; pending: number };
  lifecycle: { state: string | null; observedAt: string | null; signature: string | null; pool: string | null };
  limitations: string[];
}
export interface IntelligenceCandidate {
  mint: string; name: string; symbol: string; marketCap: IntelligenceMetric; liquidity: IntelligenceMetric;
}

export function isIntelligenceMint(mint: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return false;
  try { return bs58.decode(mint).length === 32; } catch { return false; }
}

export function measuredNumber(raw: unknown): number | null {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Explicit public adapter: no vendor IDs, error text, URLs or raw evidence leave this boundary. */
export function intelligenceMetric(id: string, label: string, category: IntelligenceCategory,
  unit: IntelligenceMetric['unit'], raw: unknown, evidence?: MetricEvidence, now = Date.now()): IntelligenceMetric {
  let value = unit === 'boolean' ? typeof raw === 'boolean' ? raw : null : measuredNumber(raw);
  if (unit === '%' && typeof value === 'number' && value > 100) value = null;
  const at = evidence?.observedAt;
  const validTime = at && Number.isFinite(Date.parse(at)) && Date.parse(at) <= now + 30_000;
  const validExpiry = !evidence?.expiresAt || Number.isFinite(Date.parse(evidence.expiresAt));
  const recorded = value !== null && validTime && validExpiry && ['measured', 'stale'].includes(evidence?.status ?? '');
  return { id, label, category, unit, value: recorded ? value : null,
    observedAt: recorded ? at! : null,
    status: recorded ? evidence?.status === 'stale' || evidence?.expiresAt && Date.parse(evidence.expiresAt) <= now ? 'stale' : 'measured'
      : evidence?.status === 'loading' ? 'loading' : 'unavailable' };
}

export interface IntelligenceInputs {
  mint: string; audit: TokenAudit; card?: TokenCardPatch;
  metadata?: { token: (JupiterAuditToken & Partial<JupiterToken>) | null; evidence: MetricEvidence };
  overview?: { token: TokenOverview; evidence: MetricEvidence };
}

export function buildLiveIntelligence(input: IntelligenceInputs, now = Date.now()): LiveIntelligenceReport {
  const { mint, audit, card, metadata, overview } = input;
  const fields = card?.changedFields, meta = metadata?.token;
  const metrics: IntelligenceMetric[] = [];
  const add = (id: string, label: string, category: IntelligenceCategory, unit: IntelligenceMetric['unit'], raw: unknown, evidence?: MetricEvidence) => {
    const metric = intelligenceMetric(id, label, category, unit, raw, evidence, now); metrics.push(metric); return metric;
  };
  const cardEvidence = (key: keyof TokenCardFields, group?: MetricEvidence): MetricEvidence | undefined => {
    const at = card?.fieldObservedAt?.[key];
    // Market fields have independent observation times; another group's tick cannot refresh them.
    if (!at || !Number.isFinite(Date.parse(at))) return group;
    if (group && group.status !== 'measured' && group.status !== 'stale') return group;
    return { status: card?.freshness === 'stale' ? 'stale' : group?.status ?? 'measured', source: 'card', observedAt: at,
      expiresAt: new Date(Date.parse(at) + 60_000).toISOString() };
  };
  const market = (id: string, label: string, key: keyof TokenCardFields, primary: unknown, fallback: unknown) => {
    const candidates = [
      intelligenceMetric(id, label, 'market', 'USD', fields?.[key], cardEvidence(key, fields?.marketEvidence), now),
      intelligenceMetric(id, label, 'market', 'USD', primary, overview?.evidence, now),
      intelligenceMetric(id, label, 'market', 'USD', fallback, metadata?.evidence, now),
    ];
    metrics.push(candidates.find(m => m.status === 'measured') ?? candidates.find(m => m.status === 'stale') ?? candidates[0]);
  };
  market('price', 'Price', 'priceUsd', overview?.token.price, meta?.usdPrice);
  market('marketCap', 'Market cap', 'marketCapUsd', overview?.token.marketCap, meta?.mcap);
  market('liquidity', 'Liquidity', 'liquidityUsd', overview?.token.liquidity, meta?.liquidity);
  const buyVolume = measuredNumber(meta?.stats24h?.buyVolume), sellVolume = measuredNumber(meta?.stats24h?.sellVolume);
  market('volume24h', 'Volume · 24h', 'volume24hUsd', overview?.token.v24hUSD,
    buyVolume !== null && sellVolume !== null ? buyVolume + sellVolume : null);
  add('top10', 'Top 10 holdings', 'ownership', '%', audit.top10HoldersPct, audit.top10Evidence);
  add('dev', 'Developer holdings', 'ownership', '%', audit.devBalancePct, audit.devBalanceEvidence);
  add('snipers', 'Sniper holdings', 'ownership', '%', audit.snipersPct, audit.ownershipEvidence);
  add('insiders', 'Insider holdings', 'ownership', '%', audit.insidersPct, audit.ownershipEvidence);
  add('bundlers', 'Bundled holdings', 'ownership', '%', audit.bundlersPct, audit.ownershipEvidence);
  const holder = intelligenceMetric('holders', 'Holders', 'ownership', 'count', audit.totalHolders, audit.ownershipEvidence, now);
  metrics.push(holder.value !== null ? holder : intelligenceMetric('holders', 'Holders', 'ownership', 'count', meta?.holderCount, metadata?.evidence, now));
  add('mintRevoked', 'Mint authority revoked', 'security', 'boolean', audit.mintAuthorityDisabled, audit.mintAuthorityEvidence);
  add('freezeRevoked', 'Freeze authority revoked', 'security', 'boolean', audit.freezeAuthorityDisabled, audit.freezeAuthorityEvidence);
  add('lpLocked', 'Liquidity lock verified', 'security', 'boolean', audit.liquidityLocked, audit.liquidityEvidence);
  add('launches', 'Recorded creator launches', 'creator', 'count', audit.devMints, audit.historyEvidence);
  add('migrations', 'Recorded creator migrations', 'creator', 'count', audit.devMigrations, audit.historyEvidence);
  const findings = deriveFindings(metrics);
  const life = fields?.lifecycleEvidence;
  const lifecycleObserved = life && ['measured', 'stale'].includes(life.status) && Number.isFinite(Date.parse(life.observedAt)) && Date.parse(life.observedAt) <= now + 30_000;
  const signature = lifecycleObserved && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(fields?.migrationSignature ?? '') ? fields!.migrationSignature! : null;
  const text = (value: unknown) => typeof value === 'string' ? sanitizeTokenName(value).value : '';
  return { schemaVersion: '2', methodologyVersion: 'observed-evidence-v1', generatedAt: new Date(now).toISOString(),
    token: { mint, chain: 'solana', symbol: text(meta?.symbol ?? overview?.token.symbol ?? audit.symbol).slice(0, 32) || 'Token',
      name: text(meta?.name ?? overview?.token.name).slice(0, 120) || 'Unidentified token',
      creator: audit.creatorAddress && isIntelligenceMint(audit.creatorAddress) ? audit.creatorAddress : null },
    metrics, findings,
    coverage: { total: metrics.length, measured: metrics.filter(m => m.status === 'measured').length,
      stale: metrics.filter(m => m.status === 'stale').length, pending: metrics.filter(m => m.status === 'loading').length },
    lifecycle: { state: lifecycleObserved ? fields?.lifecycleState ?? null : null, observedAt: lifecycleObserved ? life.observedAt : null,
      signature, pool: lifecycleObserved && isIntelligenceMint(fields?.migratedPool ?? '') ? fields!.migratedPool! : null },
    limitations: [
      'Missing evidence is not evidence of safety. No overall safety score is assigned to a partial report.',
      'Ownership classifications are heuristic observations, not proof that wallets share an owner or intent.',
      'Recorded launches and migrations do not establish creator reputation or a history of rugs.',
      'Wallet clusters, wash-trading claims and exit-price simulations are not inferred from aggregate metrics. Review a live quote in Trade for an actual amount.',
    ] };
}

export function deriveFindings(metrics: IntelligenceMetric[]): IntelligenceFinding[] {
  const result: IntelligenceFinding[] = [];
  const check = (id: string, threshold: number, title: string, description: string) => {
    const metric = metrics.find(m => m.id === id);
    if (metric?.value !== null && typeof metric?.value === 'number' && metric.value >= threshold) result.push({ id, severity: 'attention', title, description, evidenceIds: [id] });
  };
  check('top10', 35, 'Concentrated ownership', 'The top ten holders control at least 35% of supply. Concentration can amplify selling pressure; pool and program accounts may affect this measure.');
  check('dev', 5, 'Developer allocation to review', 'The developer retains at least 5% of supply. This is an exposure to review, not a prediction of their actions.');
  for (const id of ['mintRevoked', 'freezeRevoked']) {
    const metric = metrics.find(m => m.id === id);
    if (metric?.value === false) result.push({ id, severity: 'attention', title: id === 'mintRevoked' ? 'Mint authority remains active' : 'Freeze authority remains active',
      description: id === 'mintRevoked' ? 'The observed authority can issue additional supply.' : 'The observed authority can freeze token accounts.', evidenceIds: [id] });
  }
  const liquidity = metrics.find(m => m.id === 'liquidity');
  if (typeof liquidity?.value === 'number' && liquidity.value < 10_000) result.push({ id: 'thinLiquidity', severity: 'attention', title: 'Limited observed liquidity',
    description: 'Observed liquidity is below $10,000. A small trade may have a substantial price impact; liquidity alone does not establish exitability.', evidenceIds: ['liquidity'] });
  return result;
}
