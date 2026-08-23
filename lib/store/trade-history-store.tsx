'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData, ApiRequestError } from '@/lib/api/response';

export interface TradeRecord {
  id: string;
  txHash: string;
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string;
  side: 'buy' | 'sell';
  inputAmount: string;
  outputAmount: string;
  priceUsd: string;
  status: 'confirmed' | 'pending' | 'failed' | 'rejected' | 'expired' | 'dropped' | 'unknown';
  timestamp: string;
  networkFeeSol: string;
  route: string;
  provider: string;
  explorerUrl: string;
}

interface TradeHistoryContextType {
  trades: TradeRecord[];
  addTradeRecord: (record: Omit<TradeRecord, 'id' | 'timestamp' | 'explorerUrl'>) => void;
  getTradeById: (id: string) => TradeRecord | undefined;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Order rows as `/api/v1/trading/history` returns them. */
interface HistoryRow {
  id: string;
  txHash: string | null;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenMint: string | null;
  side: string;
  status: string;
  quantity: string | null;
  filledQuantity: string | null;
  averageFillPrice: string | null;
  timestamp: string;
}

/**
 * Maps a persisted order onto the record the UI renders.
 *
 * Fields the order domain genuinely does not carry — route, provider, network
 * fee — are left blank rather than filled with plausible strings. An order that
 * has not settled has no transaction hash, so there is no explorer link either.
 */
function toTradeRecord(row: HistoryRow): TradeRecord {
  const statusMap: Record<string, TradeRecord['status']> = {
    FILLED: 'confirmed',
    PARTIALLY_FILLED: 'pending',
    CREATED: 'pending',
    PENDING: 'pending',
    SUBMITTED: 'pending',
    CANCELLED: 'rejected',
    FAILED: 'failed',
    EXPIRED: 'expired',
  };

  return {
    id: row.id,
    txHash: row.txHash ?? '',
    tokenName: row.tokenName ?? row.tokenMint ?? 'Unknown token',
    tokenSymbol: row.tokenSymbol ?? '—',
    tokenMint: row.tokenMint ?? '',
    side: row.side === 'sell' ? 'sell' : 'buy',
    inputAmount: row.quantity ?? '—',
    outputAmount: row.filledQuantity ?? '—',
    priceUsd: row.averageFillPrice ?? '—',
    status: statusMap[row.status] ?? 'unknown',
    timestamp: row.timestamp,
    networkFeeSol: '—',
    route: '—',
    provider: '—',
    explorerUrl: row.txHash ? `https://solscan.io/tx/${row.txHash}` : '',
  };
}


const TradeHistoryContext = createContext<TradeHistoryContextType | null>(null);

export function TradeHistoryProvider({ children }: { children: React.ReactNode }) {
  /**
   * Trade history is server state.
   *
   * This store previously seeded `INITIAL_TRADES` — fabricated confirmed trades
   * with invented transaction hashes — and kept everything else in memory, so a
   * real trade vanished on refresh while the fake ones persisted forever.
   * Orders placed through `/api/v1/orders` are the actual history.
   */
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(endpoints.trading.history, { limit: 100 }), {
        credentials: 'include',
      });
      const data = await readApiData<{ trades: HistoryRow[] }>(res, 'Failed to load trade history');
      setTrades((data.trades ?? []).map(toTradeRecord));
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        // Signed out: an empty history is correct, not a failure.
        setTrades([]);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load trade history.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Records a trade locally and re-reads from the server.
   *
   * The optimistic row keeps the UI responsive the instant an order is placed;
   * the refetch replaces it with the persisted row, so what is on screen a
   * moment later is what the database actually holds.
   */
  const addTradeRecord = useCallback(
    (record: Omit<TradeRecord, 'id' | 'timestamp' | 'explorerUrl'>) => {
      const id = `local_${Date.now()}`;
      const timestamp = new Date().toISOString();
      const explorerUrl = record.txHash ? `https://solscan.io/tx/${record.txHash}` : '';
      setTrades((prev) => [{ id, timestamp, explorerUrl, ...record }, ...prev]);
      void refresh();
    },
    [refresh],
  );

  const getTradeById = useCallback(
    (id: string) => trades.find((t) => t.id === id),
    [trades],
  );

  return (
    <TradeHistoryContext.Provider
      value={{ trades, addTradeRecord, getTradeById, isLoading, error, refresh }}
    >
      {children}
    </TradeHistoryContext.Provider>
  );
}

export function useTradeHistory() {
  const ctx = useContext(TradeHistoryContext);
  if (!ctx) {
    throw new Error('useTradeHistory must be used within a TradeHistoryProvider');
  }
  return ctx;
}
