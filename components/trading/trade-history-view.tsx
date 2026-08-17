'use client';

import React, { useState } from 'react';
import { History, ExternalLink, Filter } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { useTradeHistory, TradeRecord } from '@/lib/store/trade-history-store';
import { TradeDetailsModal } from './trade-details-modal';

export function TradeHistoryView() {
  const { trades } = useTradeHistory();
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'failed' | 'pending'>('all');
  const [selectedTrade, setSelectedTrade] = useState<TradeRecord | null>(null);

  const filteredTrades = trades.filter((t) => {
    if (filter === 'confirmed') return t.status === 'confirmed';
    if (filter === 'failed') return t.status === 'failed';
    if (filter === 'pending') return t.status === 'pending';
    return true;
  });

  const columns: Column<TradeRecord>[] = [
    {
      key: 'token',
      header: 'Token / Side',
      accessor: (t) => (
        <div className="flex items-center gap-2 font-mono">
          <Badge variant={t.side === 'buy' ? 'success' : 'danger'} size="sm">
            {t.side.toUpperCase()}
          </Badge>
          <div>
            <p className="font-bold text-slate-100">{t.tokenName}</p>
            <p className="text-2xs text-slate-400">${t.tokenSymbol}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'amounts',
      header: 'Input → Output',
      isMonospace: true,
      accessor: (t) => (
        <div>
          <p className="text-slate-300">{t.inputAmount}</p>
          <p className="text-emerald-400 font-bold">→ {t.outputAmount}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      isMonospace: true,
      align: 'right',
      accessor: (t) => <span className="font-bold text-slate-200">{t.priceUsd}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      accessor: (t) => {
        const variant =
          t.status === 'confirmed'
            ? 'success'
            : t.status === 'pending'
            ? 'warning'
            : 'danger';
        return (
          <Badge variant={variant} size="sm">
            {t.status.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'txHash',
      header: 'Transaction',
      isMonospace: true,
      align: 'right',
      accessor: (t) => (
        <button
          onClick={() => setSelectedTrade(t)}
          className="text-sky-400 hover:underline flex items-center justify-end gap-1 font-bold"
        >
          {t.txHash.slice(0, 6)}...{t.txHash.slice(-4)}
          <ExternalLink className="h-3 w-3" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <History className="h-4 w-4 text-sky-400" /> Account Trade History
        </h2>

        <div className="flex items-center gap-1 bg-sentinel-900/80 p-1 rounded-lg border border-sentinel-800 text-xs">
          {(['all', 'confirmed', 'pending', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-center transition font-bold uppercase ${
                filter === f
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Trade History Table */}
      <Panel padding="none">
        <DataTable
          columns={columns}
          data={filteredTrades}
          keyExtractor={(t) => t.id}
          onRowClick={(t) => setSelectedTrade(t)}
        />
      </Panel>

      {/* Transaction Details Modal */}
      <TradeDetailsModal
        isOpen={Boolean(selectedTrade)}
        onClose={() => setSelectedTrade(null)}
        trade={selectedTrade}
      />
    </div>
  );
}
