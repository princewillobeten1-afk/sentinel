'use client';

import React, { createContext, useContext, useState } from 'react';

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
}

const INITIAL_TRADES: TradeRecord[] = [
  {
    id: 'tx_001',
    txHash: '8kL9z2mP1xQ5wN3a19TestSignature001',
    tokenName: 'Solana Sentinel',
    tokenSymbol: 'SENT',
    tokenMint: '7xK99zK8mP2xQ5wN3a19',
    side: 'buy',
    inputAmount: '0.5000 SOL',
    outputAmount: '20.6521 SENT',
    priceUsd: '$3.4500',
    status: 'confirmed',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    networkFeeSol: '0.000005 SOL',
    route: 'Orca Whirlpools → Raydium CLMM',
    provider: 'Jupiter Aggregator',
    explorerUrl: 'https://solscan.io/tx/8kL9z2mP1xQ5wN3a19TestSignature001',
  },
  {
    id: 'tx_002',
    txHash: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19Sig002',
    tokenName: 'Bonk Doge',
    tokenSymbol: 'BONK',
    tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    side: 'buy',
    inputAmount: '1.2000 SOL',
    outputAmount: '6,009,490.33 BONK',
    priceUsd: '$0.00002845',
    status: 'confirmed',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    networkFeeSol: '0.000005 SOL',
    route: 'Raydium CLMM',
    provider: 'Jupiter Aggregator',
    explorerUrl: 'https://solscan.io/tx/3mR8z9K2xP5wN1a84mP2xQ5wN3a19Sig002',
  },
  {
    id: 'tx_003',
    txHash: '7aB2z9K1xP4wN2a99mP3xQ6wN4a20Sig003',
    tokenName: 'Cyber Quantum',
    tokenSymbol: 'QUANT',
    tokenMint: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19TestMint',
    side: 'sell',
    inputAmount: '1,000.00 QUANT',
    outputAmount: '0.2890 SOL',
    priceUsd: '$0.0412',
    status: 'failed',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    networkFeeSol: '0.000005 SOL',
    route: 'Meteora DLMM',
    provider: 'Jupiter Aggregator',
    explorerUrl: 'https://solscan.io/tx/7aB2z9K1xP4wN2a99mP3xQ6wN4a20Sig003',
  },
];

const TradeHistoryContext = createContext<TradeHistoryContextType | null>(null);

export function TradeHistoryProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<TradeRecord[]>(INITIAL_TRADES);

  const addTradeRecord = (record: Omit<TradeRecord, 'id' | 'timestamp' | 'explorerUrl'>) => {
    const id = `tx_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const explorerUrl = `https://solscan.io/tx/${record.txHash}`;

    setTrades((prev) => [{ id, timestamp, explorerUrl, ...record }, ...prev]);
  };

  const getTradeById = (id: string) => trades.find((t) => t.id === id);

  return (
    <TradeHistoryContext.Provider value={{ trades, addTradeRecord, getTradeById }}>
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
