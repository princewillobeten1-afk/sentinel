'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldAlert, TrendingUp, Settings2, ShieldCheck, Activity } from 'lucide-react';

export function CopyConfigModal() {
  const [allocation, setAllocation] = useState('5000');
  const [maxTrade, setMaxTrade] = useState('500');
  const [maxRisk, setMaxRisk] = useState('70');
  const [minExitability, setMinExitability] = useState('60');
  const [mode, setMode] = useState<'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'>('BALANCED');

  return (
    <Card className="w-full max-w-lg mx-auto p-6 border-border/50 bg-background/95 backdrop-blur shadow-2xl">
      <div className="mb-6">
        <h3 className="text-xl font-bold">Copy Profile</h3>
        <p className="text-sm text-muted-foreground mt-1">Configure your safety limits for mirroring this trader.</p>
      </div>

      <div className="flex bg-muted/50 p-1 rounded-lg mb-6">
        {['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'].map(m => (
          <button
            key={m}
            className={`flex-1 py-2 rounded-md text-xs font-semibold tracking-wide transition-all ${
              mode === m 
                ? m === 'CONSERVATIVE' ? 'bg-emerald-500/20 text-emerald-400' 
                  : m === 'BALANCED' ? 'bg-sky-500/20 text-sky-400' 
                  : 'bg-rose-500/20 text-rose-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode(m as any)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Total Allocation (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">$</span>
              <Input 
                type="number" 
                value={allocation} 
                onChange={e => setAllocation(e.target.value)}
                className="pl-7 font-mono font-bold bg-secondary/30"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Max Per Trade (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground font-semibold">$</span>
              <Input 
                type="number" 
                value={maxTrade} 
                onChange={e => setMaxTrade(e.target.value)}
                className="pl-7 font-mono font-bold bg-secondary/30"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-secondary/20 border border-border/50 rounded-xl space-y-4">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Execution Safety Rules
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Max Token Risk
                <span className="text-2xs bg-rose-500/10 text-rose-400 px-1 rounded">≤ {maxRisk}</span>
              </label>
              <Input 
                type="number" 
                value={maxRisk} 
                onChange={e => setMaxRisk(e.target.value)}
                className="font-mono bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                Min Exitability
                <span className="text-2xs bg-emerald-500/10 text-emerald-400 px-1 rounded">≥ {minExitability}</span>
              </label>
              <Input 
                type="number" 
                value={minExitability} 
                onChange={e => setMinExitability(e.target.value)}
                className="font-mono bg-background"
              />
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground p-3 bg-card border rounded-lg flex items-start gap-2">
          <Activity className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p>
            Trades that exceed these safety limits will be <strong>skipped</strong> or <strong>scaled down</strong> automatically. You will receive an alert explaining why.
          </p>
        </div>

        <Button className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
          Start Copying
        </Button>
      </div>
    </Card>
  );
}
