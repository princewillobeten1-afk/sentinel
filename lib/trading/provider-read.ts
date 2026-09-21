import 'server-only';
import type { MetricEvidence } from '@/lib/discovery/types';

export class ProviderReadError extends Error {
  constructor(public reason: string, public retryMs = 30_000) { super(reason); }
}
const pauseUntil = new Map<string, number>();
/** A bounded read with account-level cooldown. Never return provider error bodies (may contain keys). */
export async function readProvider(provider: string, url: string, init: RequestInit = {}): Promise<any> {
  if ((pauseUntil.get(provider) ?? 0) > Date.now()) throw new ProviderReadError(`${provider} is cooling down after a quota or access error.`);
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    const body = await response.json().catch(() => null);
    const quota = /quota|compute units|cu limit|credits|usage limit/i.test(JSON.stringify(body?.message ?? body?.error ?? ''));
    if (!response.ok || body?.success === false || body?.error) {
      const retry = response.headers.get('retry-after');
      const retryMs = retry ? Math.max(30_000, /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 60_000;
      const pause = quota || [401,403].includes(response.status) ? 15 * 60_000 : response.status === 429 ? (Number.isFinite(retryMs) ? retryMs : 60_000) : 30_000;
      pauseUntil.set(provider, Date.now() + pause);
      throw new ProviderReadError(quota ? `${provider} quota exhausted.` : `${provider} unavailable (HTTP ${response.status}).`, pause);
    }
    if (!body || typeof body !== 'object') throw new ProviderReadError(`${provider} returned an invalid response.`);
    return body;
  } catch (error) {
    if (error instanceof ProviderReadError) throw error;
    throw new ProviderReadError(`${provider} request timed out or failed.`);
  }
}
export function evidence(source: string, ttlMs: number, reason?: string): MetricEvidence {
  const now = Date.now();
  return { source, status: reason ? 'unavailable' : 'measured', observedAt: new Date(now).toISOString(), expiresAt: new Date(now + ttlMs).toISOString(), ...(reason ? {reason} : {}) };
}
export function failureReason(error: unknown): string { return error instanceof ProviderReadError ? error.reason : 'Provider data unavailable.'; }
export function resetProviderCooldowns() { pauseUntil.clear(); }
