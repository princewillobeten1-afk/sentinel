'use client';

import React from 'react';
import { BrainCircuit, Users, ShieldAlert, GitBranch, Key } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function IntelligenceView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-sky-400" /> Sentinel Blockchain Intelligence
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Effective ownership clusters, wallet-funding concentration graph, and creator history records.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Holder Clustering Engine" subtitle="Group raw wallets by shared funding sources">
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-sentinel-950 border border-sentinel-800 space-y-1">
              <div className="flex justify-between font-mono text-2xs">
                <span className="font-bold text-sky-300">$SENT Cluster 1</span>
                <Badge variant="risk-low">3,150 Independent Wallets</Badge>
              </div>
              <p className="text-slate-400">92.4% authentic distribution across Binance & Coinbase withdrawal origins.</p>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-1">
              <div className="flex justify-between font-mono text-2xs">
                <span className="font-bold text-rose-400">$SOLM Cluster 3</span>
                <Badge variant="risk-critical">17 Connected Wallets</Badge>
              </div>
              <p className="text-slate-300">All 17 wallets funded from single address `7xK9...2mP` within 22 minutes.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Creator Reputation Database" subtitle="Cross-wallet history and previous token lifespans">
          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between py-2 border-b border-sentinel-800">
              <span className="text-slate-400">Creator Wallet 9pQ1...4c00</span>
              <span className="text-emerald-400 font-bold">12 tokens launched (0 rugged)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-sentinel-800">
              <span className="text-slate-400">Creator Wallet 4zW8...9kL2</span>
              <span className="text-rose-400 font-bold">4 tokens launched (3 rugged &lt; 10m)</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
