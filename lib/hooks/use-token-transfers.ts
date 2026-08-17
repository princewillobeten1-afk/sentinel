'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TransferEvent } from '@/lib/api/birdeye/balance';

export interface UseTokenTransfersOptions {
  tokenAddress?: string;
  chain?: string;
  limit?: number;
  flow?: 'in' | 'out';
  pollIntervalMs?: number;
}

export function useTokenTransfers({
  tokenAddress,
  chain = 'solana',
  limit = 20,
  pollIntervalMs = 15000,
}: UseTokenTransfersOptions = {}) {
  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    if (!tokenAddress) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/v1/tokens/${chain}/${tokenAddress}/transfers?limit=${limit}&include_total=true`
      );
      const json = await res.json();

      if (json.success && json.data) {
        setTransfers(json.data.items || []);
        setTotal(json.data.total || 0);
        setError(null);
      } else {
        setError(json.error || 'Failed to fetch transfers');
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching transfers');
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, chain, limit]);

  useEffect(() => {
    fetchTransfers();
    if (pollIntervalMs > 0 && tokenAddress) {
      const interval = setInterval(fetchTransfers, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchTransfers, pollIntervalMs, tokenAddress]);

  return {
    transfers,
    total,
    isLoading,
    error,
    refetch: fetchTransfers,
  };
}
