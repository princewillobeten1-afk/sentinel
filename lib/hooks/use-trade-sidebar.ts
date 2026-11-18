'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveTokenUpdates } from './use-live-token-updates';
import type { TradeSidebarSnapshot } from '@/lib/trading/sidebar-model';
import type { TradeWalletPosition } from '@/lib/trading/sidebar-model';
import type { DiscoveryToken } from '@/lib/discovery/types';
import { mergeTokenCardSnapshot } from '@/lib/discovery/card-snapshot';

export function useTradeSidebar(mint: string, wallet: string | null, chain: string = 'solana') {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ mint: string; data: TradeSidebarSnapshot; error?: string } | null>(null);
  const [positionState, setPosition] = useState<{ key: string; data: TradeWalletPosition | null; error?: string } | null>(null);
  const { updates } = useLiveTokenUpdates(mint ? [mint] : []);
  const key = `${wallet ?? ''}:${mint}`;
  useEffect(() => {
    if (!mint) return;
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const normalizedChain = chain?.toLowerCase() === 'robinhood' ? 'robinhood' : 'solana';
        const response = await fetch(`/api/v1/tokens/${normalizedChain}/${encodeURIComponent(mint)}/card`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok || body?.data?.token?.mint !== mint) throw new Error('Token information unavailable');
        if (!controller.signal.aborted) setSnapshot({ mint, data: body.data.token });
      } catch {
        if (!controller.signal.aborted) setSnapshot(previous => ({ mint, data: previous?.mint === mint ? previous.data : { mint }, error: 'Token information is unavailable. Retry shortly.' }));
      } finally { busy = false; }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [mint, chain, revision]);

  useEffect(() => {
    if (!wallet || !mint || chain?.toLowerCase() === 'robinhood') return;
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/v1/trading/position/${encodeURIComponent(wallet)}/${encodeURIComponent(mint)}`, { credentials: 'include', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(response.status === 401
          ? 'Sign in to view this wallet position.'
          : response.status === 403
            ? 'Link this wallet to your account to view its position.'
            : 'Wallet position is temporarily unavailable.');
        if (body?.data?.position?.wallet !== wallet || body.data.position.mint !== mint) throw new Error('Wallet position is temporarily unavailable.');
        const data = body.data.position as TradeWalletPosition;
        if (!controller.signal.aborted) setPosition({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) setPosition({ key, data: null, error: error instanceof Error ? error.message : 'Wallet position is temporarily unavailable.' });
      } finally { busy = false; }
    };
    void load();
    const timer = setInterval(load, 30_000);
    window.addEventListener('sentinel:positions-updated', load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('sentinel:positions-updated', load); };
  }, [wallet, mint, key, revision]);
  const data = useMemo(() => {
    const rest = snapshot?.mint === mint ? snapshot.data : { mint };
    const live = updates.get(mint);
    if (!live) return rest;
    const { priceUsd, observedAt, updatedAt, fieldObservedAt, ...fields } = live;
    const merged = mergeTokenCardSnapshot(rest as DiscoveryToken, {
      mint, sequence: 0, source: 'token.card', freshness: 'fresh',
      observedAt: observedAt ?? new Date(updatedAt).toISOString(),
      changedFields: { ...fields, ...(priceUsd === undefined ? {} : { priceUsd: String(priceUsd) }) },
      fieldObservedAt,
    }) as TradeSidebarSnapshot;

    // Enforce data consistency: classified wallet counts cannot exceed total holders
    if (typeof merged.holdersCount === 'number' && merged.holdersCount >= 0) {
      if (typeof merged.proTradersCount === 'number') {
        merged.proTradersCount = Math.min(merged.proTradersCount, merged.holdersCount);
      }
      if (typeof merged.devCount === 'number') {
        merged.devCount = Math.min(merged.devCount, merged.holdersCount);
      }
      if (typeof merged.sniperCount === 'number') {
        merged.sniperCount = Math.min(merged.sniperCount, merged.holdersCount);
      }
      if (typeof merged.bundlerCount === 'number') {
        merged.bundlerCount = Math.min(merged.bundlerCount, merged.holdersCount);
      }
      if (typeof merged.insiderCount === 'number') {
        merged.insiderCount = Math.min(merged.insiderCount, merged.holdersCount);
      }
      if (typeof merged.kolsCount === 'number') {
        merged.kolsCount = Math.min(merged.kolsCount, merged.holdersCount);
      }
    }
    return merged;
  }, [snapshot, mint, updates]);
  return { data, loading: snapshot?.mint !== mint, error: snapshot?.mint === mint ? snapshot.error : undefined,
    position: wallet && positionState?.key === key ? positionState.data : null,
    positionError: wallet && positionState?.key === key ? positionState.error : undefined,
    positionLoading: Boolean(wallet && positionState?.key !== key),
    refresh: useCallback(() => setRevision(value => value + 1), []) };
}
