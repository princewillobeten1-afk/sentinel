'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TokenAudit } from '@/lib/trading/audit-model';
import { isTokenAudit } from '@/lib/trading/audit-model';
import type { MetricEvidence } from '@/lib/discovery/types';
import { currentEvidence } from '@/lib/discovery/audit-freshness';
import { useEvidenceClock } from './use-evidence-clock';

const evidenceKeys = ['marketEvidence', 'ownershipEvidence', 'securityEvidence', 'creatorEvidence', 'lifecycleEvidence',
  'liquidityEvidence', 'top10Evidence', 'devBalanceEvidence', 'mintAuthorityEvidence', 'freezeAuthorityEvidence',
  'organicEvidence', 'historyEvidence'] as const;

export function useTokenAudit(mint: string, active: boolean) {
  const [snapshot, setSnapshot] = useState<{ mint: string; data: TokenAudit | null; error: string | null; refreshing: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const current = snapshot?.mint === mint ? snapshot : null;
  const now = useEvidenceClock(...evidenceKeys.map(key => current?.data?.[key]));

  useEffect(() => {
    if (!active || !mint) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const isHidden = () => document.visibilityState === 'hidden';
    const poll = async () => {
      if (disposed || controller || isHidden()) return;
      clearTimeout(timer);
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 10_000);
      setSnapshot(previous => ({ mint, data: previous?.mint === mint ? previous.data : null,
        error: previous?.mint === mint ? previous.error : null, refreshing: true }));
      let delay = 15_000;
      try {
        const response = await fetch(`/api/v1/tokens/solana/${encodeURIComponent(mint)}/audit`, {
          signal: request.signal, cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Audit refresh failed (HTTP ${response.status}).`);
        const body = await response.json();
        const data: unknown = body?.data;
        if (!body?.success || !isTokenAudit(data, mint)) {
          throw new Error('Audit provider returned an invalid response.');
        }
        if (!disposed) setSnapshot({ mint, data, error: null, refreshing: false });
        if (data.holderAuditPending) delay = 3_000;
      } catch (error) {
        if (!disposed) setSnapshot(previous => ({ mint, data: previous?.mint === mint ? previous.data : null,
          error: request.signal.aborted ? 'Audit refresh timed out.' : error instanceof Error ? error.message : 'Audit refresh failed.', refreshing: false }));
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (!disposed && !isHidden()) timer = setTimeout(poll, delay);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') clearTimeout(timer);
      else void poll();
    };
    void poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mint, active, revision]);

  // Derive freshness; never mutate the measured snapshot or discard provenance.
  const data = current?.data ? { ...current.data } : null;
  if (data) for (const key of evidenceKeys) {
    const evidence = currentEvidence(data[key], now);
    data[key] = current?.error ? { ...evidence, status: evidence.status === 'measured' || evidence.status === 'stale' ? 'stale' : 'unavailable', reason: current.error } as MetricEvidence : evidence;
  }
  return { data, error: current?.error ?? null, refreshing: current?.refreshing ?? false, refresh };
}
