import 'server-only';
import { getTokenAudit, getAuditMetadata } from '@/lib/trading/audit-service';
import { getTokenCardPatch, hydrateTokenCards } from '@/lib/market/live/card-cache';
import { getTokenOverview } from '@/lib/api/birdeye/stats';
import { fetchLiveSolanaTokens } from '@/lib/discovery/live-solana-feed';
import { dbPool, isPostgresConfigured } from '@/lib/server/db/pool';
import { ApiError } from '@/lib/server/errors';
import { logger } from '@/lib/server/logger';
import { buildLiveIntelligence, intelligenceMetric, isIntelligenceMint, type IntelligenceInputs, type LiveIntelligenceReport, type IntelligenceCandidate } from './live-model';

const overviewCache = new Map<string, { data?: IntelligenceInputs['overview']; retryAt: number }>();
const inFlight = new Map<string, Promise<LiveIntelligenceReport>>();
const hydrationRequests = new Map<string, Promise<void>>();
let cooldownUntil = 0;
let budget = { resetAt: 0, requests: 0 };
let candidatesRequest: Promise<IntelligenceCandidate[]> | null = null;
let candidatesCache: { rows: IntelligenceCandidate[]; expires: number } | null = null;

export function validateIntelligenceToken(chain: string, mint: string) {
  if (chain !== 'solana') throw new ApiError('Intelligence currently supports Solana.', 400, 'UNSUPPORTED_CHAIN');
  if (!isIntelligenceMint(mint)) throw new ApiError('Enter an exact Solana mint address, not a symbol.', 400, 'INVALID_MINT');
}

async function marketOverview(mint: string): Promise<IntelligenceInputs['overview']> {
  const cached = overviewCache.get(mint);
  if (cached && cached.retryAt > Date.now()) return cached.data;
  const evidence = getTokenCardPatch(mint)?.changedFields.marketEvidence;
  const hasRecentMarket = evidence?.status === 'measured' && Date.now() - Date.parse(evidence.observedAt) < 30_000;
  if (hasRecentMarket || !process.env.BIRDEYE_API_KEY || cooldownUntil > Date.now()) return cached?.data;
  if (Date.now() >= budget.resetAt) budget = { resetAt: Date.now() + 60_000, requests: 0 };
  if (budget.requests >= 20) return cached?.data;
  budget.requests++;
  try {
    const token = await getTokenOverview({ address: mint, frames: '24h' });
    if (token?.address !== mint) throw new Error('Exact mint mismatch');
    const now = Date.now();
    const data = { token, evidence: { status: 'measured' as const, source: 'birdeye-token-overview', observedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60_000).toISOString() } };
    overviewCache.set(mint, { data, retryAt: now + 30_000 });
    return data;
  } catch (error) {
    // Internal diagnostic only. Retain prior measurements with their original observation time.
    const message = error instanceof Error ? error.message : 'Market request failed';
    if (/429|quota|401|403/i.test(message)) cooldownUntil = Date.now() + 60_000;
    logger.debug('[intelligence] market reconciliation unavailable', { mint, message });
    const data = cached?.data ? { ...cached.data, evidence: { ...cached.data.evidence, status: 'stale' as const } } : undefined;
    overviewCache.set(mint, { data, retryAt: Date.now() + 30_000 });
    return data;
  } finally {
    if (overviewCache.size > 300) overviewCache.delete(overviewCache.keys().next().value!);
  }
}

export async function getLiveIntelligence(chain: string, mint: string): Promise<LiveIntelligenceReport> {
  validateIntelligenceToken(chain, mint);
  const existing = inFlight.get(mint);
  if (existing) return existing;
  if (inFlight.size >= 4) throw new ApiError('Analysis is busy. Please retry shortly.', 429, 'ANALYSIS_BUSY');
  const work = (async () => {
    // Redis recovery is best-effort; a stalled cache socket must not hold the report hostage.
    let hydration = hydrationRequests.get(mint);
    if (!hydration && hydrationRequests.size < 4) {
      hydration = hydrateTokenCards([mint]).catch(() => undefined).finally(() => hydrationRequests.delete(mint));
      hydrationRequests.set(mint, hydration);
    }
    if (hydration) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([hydration, new Promise<void>(resolve => { timer = setTimeout(resolve, 1_000); })]);
      if (timer) clearTimeout(timer);
    }
    const [audit, overview] = await Promise.all([getTokenAudit(mint), marketOverview(mint)]);
    return buildLiveIntelligence({ mint, audit, overview, metadata: getAuditMetadata(mint), card: getTokenCardPatch(mint) });
  })();
  inFlight.set(mint, work);
  try { return await work; } finally { inFlight.delete(mint); }
}

/** Candidate discovery never queues a full-page audit or supplies demonstration tokens. */
export async function getIntelligenceCandidates(): Promise<IntelligenceCandidate[]> {
  if (candidatesCache && candidatesCache.expires > Date.now()) return candidatesCache.rows;
  if (candidatesRequest) return candidatesRequest;
  candidatesRequest = (async () => {
    const tokens = await fetchLiveSolanaTokens();
    const rows = tokens.filter(t => t.chain === 'solana' && isIntelligenceMint(t.mint)).slice(0, 30).map(t => ({
      mint: t.mint, name: t.name, symbol: t.symbol,
      marketCap: intelligenceMetric('marketCap', 'Market cap', 'market', 'USD', t.marketCapUsd, t.marketEvidence),
      liquidity: intelligenceMetric('liquidity', 'Liquidity', 'market', 'USD', t.liquidityUsd, t.marketEvidence),
    }));
    candidatesCache = { rows, expires: Date.now() + 15_000 };
    return rows;
  })();
  try { return await candidatesRequest; } finally { candidatesRequest = null; }
}

export interface IntelligenceObservation { category: string; observedAt: string }
const historyRequests = new Map<string, Promise<{ status: 'measured' | 'unavailable'; observations: IntelligenceObservation[] }>>();
/** Read recorded observation times, not synthetic backwards snapshots or inferred events. */
export async function getIntelligenceHistory(chain: string, mint: string) {
  validateIntelligenceToken(chain, mint);
  if (!isPostgresConfigured()) return { status: 'unavailable', observations: [] };
  const existing = historyRequests.get(mint);
  if (existing) return existing;
  if (historyRequests.size >= 4) return { status: 'unavailable', observations: [] };
  const work = (async () => {
    try {
      const { rows } = await dbPool.query<{ evidence_group: string; observed_at: Date | string }>(
        `SELECT evidence_group, observed_at FROM token_card_evidence_snapshots
         WHERE mint = $1 ORDER BY observed_at DESC LIMIT 20`, [mint]);
      return { status: 'measured' as const, observations: rows.filter(row => ['ownership', 'security', 'creator', 'lifecycle'].includes(row.evidence_group))
        .map(row => ({ category: row.evidence_group, observedAt: new Date(row.observed_at).toISOString() })) };
    } catch {
      return { status: 'unavailable' as const, observations: [] };
    }
  })();
  historyRequests.set(mint, work);
  try { return await work; } finally { historyRequests.delete(mint); }
}
