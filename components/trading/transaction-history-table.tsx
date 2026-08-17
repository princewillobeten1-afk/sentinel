'use client';

import React from 'react';
import { History, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface UserTransactionItem {
  id: string;
  type: string;
  tokenSymbol: string;
  amount: string;
  valueUsd: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  txHash?: string;
  timestamp: string;
}

interface TransactionHistoryTableProps {
  transactions: UserTransactionItem[];
}

export function TransactionHistoryTable({
  transactions,
}: TransactionHistoryTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center bg-sentinel-900/40 border border-white/5 rounded-2xl font-mono">
        <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No trading transactions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-sentinel-900/40 border border-white/5 rounded-2xl overflow-hidden font-mono">
      <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Your Orders & Transaction History
          </h4>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white/[0.02] text-slate-500 text-2xs uppercase border-b border-white/5">
              <th className="p-3">Type</th>
              <th className="p-3">Asset</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Value</th>
              <th className="p-3">Status</th>
              <th className="p-3">Transaction</th>
              <th className="p-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                <td className="p-3 font-bold text-white uppercase">{tx.type}</td>
                <td className="p-3 text-sky-400 font-bold">${tx.tokenSymbol}</td>
                <td className="p-3 text-white">{tx.amount}</td>
                <td className="p-3 text-slate-300 font-bold">${tx.valueUsd.toFixed(2)}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      tx.status === 'CONFIRMED'
                        ? 'success'
                        : tx.status === 'PENDING'
                        ? 'neutral'
                        : 'danger'
                    }
                    size="sm"
                  >
                    {tx.status}
                  </Badge>
                </td>
                <td className="p-3">
                  {tx.txHash ? (
                    <a
                      href={`https://solscan.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-2xs"
                    >
                      <span>{tx.txHash.slice(0, 6)}...</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
                <td className="p-3 text-right text-slate-500 text-2xs">
                  {new Date(tx.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
