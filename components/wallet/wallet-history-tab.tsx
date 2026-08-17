'use client';

import React, { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWalletState, useNotificationsActions } from '@/lib/store';

export function WalletHistoryTab() {
  const { walletTransactions } = useWalletState();
  const { addNotification } = useNotificationsActions();

  const [filter, setFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTxs = walletTransactions.filter((tx) => {
    if (filter === 'ALL') return true;
    if (filter === 'DEPOSIT') return tx.direction === 'DEPOSIT' || tx.direction === 'RECEIVE';
    if (filter === 'WITHDRAWAL') return tx.direction === 'WITHDRAWAL' || tx.direction === 'SEND';
    return true;
  });

  const handleCopySig = (sig: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedId(sig);
    setTimeout(() => setCopiedId(null), 2000);
    addNotification({
      title: 'Signature Copied',
      message: 'Transaction signature copied to clipboard.',
      type: 'system',
    });
  };

  return (
    <div className="space-y-3.5">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-sentinel-800 pb-2">
        {(['ALL', 'DEPOSIT', 'WITHDRAWAL'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
              filter === tab
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'ALL' ? 'All Transactions' : tab === 'DEPOSIT' ? 'Deposits' : 'Withdrawals'}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {filteredTxs.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Inbox className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No {filter.toLowerCase()} transactions recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
          {filteredTxs.map((tx) => {
            const isDeposit = tx.direction === 'DEPOSIT' || tx.direction === 'RECEIVE';
            const explorerUrl =
              tx.network === 'solana'
                ? `https://solscan.io/tx/${tx.signature}`
                : `https://etherscan.io/tx/${tx.signature}`;

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-sentinel-800 bg-sentinel-900/60 p-3 hover:border-sentinel-700 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isDeposit ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isDeposit ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        {isDeposit ? 'Deposit' : 'Withdrawal'} {tx.amount} {tx.asset}
                      </span>
                      <Badge variant={tx.status === 'CONFIRMED' ? 'success' : tx.status === 'PENDING' ? 'warning' : 'danger'} size="sm">
                        {tx.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-2xs font-mono text-slate-500 mt-0.5">
                      <span>{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>
                        {isDeposit
                          ? `From: ${tx.sourceAddress?.slice(0, 10) || 'External'}`
                          : `To: ${tx.destinationAddress?.slice(0, 6)}...${tx.destinationAddress?.slice(-4)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopySig(tx.signature)}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-300 transition"
                    title="Copy Signature"
                  >
                    {copiedId === tx.signature ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => window.open(explorerUrl, '_blank')}
                    className="p-1.5 rounded text-slate-500 hover:text-sky-400 transition"
                    title="View on Explorer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
