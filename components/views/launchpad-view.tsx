'use client';

import React from 'react';
import { Rocket, ShieldCheck, Zap, Plus, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { useAppActions } from '@/lib/store';

export function LaunchpadView() {
  const { setQuickBuyOpen } = useAppActions();

  const mockLaunches = [
    {
      id: 'l1',
      name: 'Sentinel Protocol',
      symbol: '$SENT',
      raised: '85 SOL / 100 SOL',
      progress: 85,
      participants: 412,
      timeRemaining: '2h 14m',
      status: 'Active Launch',
    },
    {
      id: 'l2',
      name: 'Cyber Guard AI',
      symbol: '$CGAI',
      raised: '100 SOL / 100 SOL',
      progress: 100,
      participants: 620,
      timeRemaining: 'Graduated to Raydium',
      status: 'Migrated',
    },
  ];

  return (
    <div className="space-y-6">
      <div data-page-header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Rocket className="h-6 w-6 text-sky-400" /> Launchpad
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore the launchpad preview. Listings below use sample data.
          </p>
        </div>

        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
          Create Outcome-Aligned Token
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {mockLaunches.map((item) => (
          <Panel
            key={item.id}
            title={
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-white text-base">{item.name} ({item.symbol})</span>
                <Badge variant={item.progress >= 100 ? 'success' : 'info'}>{item.status}</Badge>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1.5 font-numeric">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Bonding Target:</span>
                  <span className="font-bold text-emerald-400">{item.raised}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-sentinel-950 overflow-hidden border border-sentinel-700">
                  <div style={{ width: `${item.progress}%` }} className="h-full bg-emerald-400 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-numeric bg-sentinel-950 p-3 rounded-lg border border-sentinel-800">
                <div>
                  <p className="text-slate-500 text-2xs">Unique Buyers</p>
                  <p className="font-bold text-white text-sm">{item.participants}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-2xs">Time Status</p>
                  <p className="font-bold text-sky-300 text-sm">{item.timeRemaining}</p>
                </div>
              </div>

              <Button
                onClick={() => setQuickBuyOpen(true, { name: item.name, symbol: item.symbol, mint: '7xK9...3a19', price: '$0.01', mcap: '$100K' })}
                variant="buy"
                className="w-full"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Participate in Launch
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
