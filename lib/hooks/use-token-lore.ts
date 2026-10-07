'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TokenLoreData } from '@/lib/lore/lore-types';

const CLIENT_LORE_CACHE = new Map<string, { data: TokenLoreData; timestamp: number }>();
const CLIENT_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export interface UseTokenLoreOptions {
  symbol?: string;
  name?: string;
  pairCreatedAt?: number;
  marketCapUsd?: number;
  enabled?: boolean;
}

export function useTokenLore(mint: string | undefined, options: UseTokenLoreOptions = {}) {
  const { symbol, name, pairCreatedAt, marketCapUsd, enabled = true } = options;

  const [lore, setLore] = useState<TokenLoreData | null>(() => {
    if (!mint) return null;
    const cached = CLIENT_LORE_CACHE.get(mint.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!lore && Boolean(mint));
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLore = useCallback(async () => {
    if (!mint || !enabled) return;

    const cacheKey = mint.toLowerCase();
    const cached = CLIENT_LORE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      setLore(cached.data);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (symbol) params.set('symbol', symbol);
      if (name) params.set('name', name);
      if (pairCreatedAt) params.set('pairCreatedAt', String(pairCreatedAt));
      if (marketCapUsd) params.set('marketCapUsd', String(marketCapUsd));

      const res = await fetch(`/api/v1/tokens/solana/${encodeURIComponent(mint)}/lore?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        CLIENT_LORE_CACHE.set(cacheKey, { data: json.data, timestamp: Date.now() });
        setLore(json.data);
      } else {
        throw new Error(json.error || 'Failed to parse lore response');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[USE_TOKEN_LORE_WARN]', err?.message);
      setError(err?.message || 'Failed to load lore');
    } finally {
      setIsLoading(false);
    }
  }, [mint, symbol, name, pairCreatedAt, marketCapUsd, enabled]);

  useEffect(() => {
    fetchLore();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLore]);

  return {
    lore,
    isLoading,
    error,
    refetch: fetchLore,
  };
}
