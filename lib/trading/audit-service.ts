import 'server-only';
import { getAudit, isAuditPending, queueAudit } from '@/lib/market/enrichment/audit-worker';
import { queueSecurityTarget } from '@/lib/market/enrichment/security-worker';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';
import { composeTokenAudit, type JupiterAuditToken } from '@/lib/trading/audit-model';
import type { MetricEvidence } from '@/lib/discovery/types';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { token: (JupiterAuditToken & Partial<import('@/lib/discovery/jupiter-feed').JupiterToken>) | null; evidence: MetricEvidence; retryAt: number }>();
const inFlight = new Map<string, Promise<void>>();

async function reconcileJupiter(address: string) {
  const cached = cache.get(address);
  if (cached && cached.retryAt > Date.now()) return;
  const existing = inFlight.get(address);
  if (existing) return existing;
  const work = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(address)}`, {
        signal: controller.signal, headers: { accept: 'application/json' }, cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Metadata provider returned HTTP ${res.status}.`);
      const body = await res.json();
      const list: unknown = Array.isArray(body) ? body : body?.tokens;
      if (!Array.isArray(list)) throw new Error('Metadata provider returned a malformed response.');
      // Never attach another token's audit to an exact mint request.
      const token: JupiterAuditToken | null = list.find(t => t?.id === address) ?? null;
      const at = Date.now();
      cache.set(address, { token, retryAt: at + CACHE_TTL_MS, evidence: {
        status: token ? 'measured' : 'unavailable', source: 'jupiter-tokens', observedAt: new Date(at).toISOString(),
        expiresAt: new Date(at + CACHE_TTL_MS).toISOString(), reason: token ? undefined : 'No exact mint match from metadata provider.',
      } });
    } catch (error) {
      cache.set(address, { token: cached?.token ?? null, retryAt: Date.now() + 15_000, evidence: {
        ...(cached?.evidence ?? { source: 'jupiter-tokens', observedAt: '' }),
        status: cached?.token ? 'stale' : 'unavailable',
        reason: error instanceof Error && error.name === 'AbortError' ? 'Metadata provider timed out.'
          : error instanceof Error ? error.message : 'Metadata provider request failed.',
      } });
    } finally {
      clearTimeout(timer);
      if (cache.size > 1_000) {
        const oldest = [...cache.keys()].find(mint => mint !== address);
        if (oldest) cache.delete(oldest);
      }
    }
  })();
  inFlight.set(address, work);
  try { await work; } finally { inFlight.delete(address); }
}


/** Shared producer: routes and Intelligence consume the same measured audit. */
export async function getTokenAudit(address: string) {
  queueAudit([address]);
  queueSecurityTarget(address);
  await reconcileJupiter(address);
  const cached = cache.get(address)!;
  return composeTokenAudit(address, getTokenCardPatch(address)?.changedFields, getAudit(address),
    cached.token, cached.evidence, isAuditPending(address));
}

/** Server-only metadata snapshot from the audit reconciliation, never a new request. */
export function getAuditMetadata(address: string) {
  return cache.get(address);
}

