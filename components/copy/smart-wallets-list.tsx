'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Activity, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';

interface SmartWallet {
  id: string;
  address: string;
  scoreOverall: number;
  scoreConsistency: number;
  scoreRisk: number;
  winRate: number;
  totalRealizedPnl: number;
  tradeCount: number;
  styleClassification: string;
  confidenceLevel: string;
}

export function SmartWalletsList() {
  const [wallets, setWallets] = useState<SmartWallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/smart-wallets')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setWallets(data.data);
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading smart wallets...</div>;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Smart Wallets</h2>
          <p className="text-muted-foreground text-sm">Discover and analyze top-performing traders.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Top Overall</Button>
          <Button variant="ghost" size="sm">Best Consistency</Button>
          <Button variant="ghost" size="sm">Risk-Adjusted</Button>
        </div>
      </div>

      <div className="grid gap-4">
        {wallets.map(wallet => (
          <Card key={wallet.id} className="p-5 border-border/50 bg-background/50 hover:bg-background/80 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4 w-full md:w-1/3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-lg">{wallet.address}</h3>
                <div className="flex gap-2 mt-1 text-xs">
                  <Badge variant="neutral">{wallet.styleClassification}</Badge>
                  <Badge variant={wallet.confidenceLevel === 'HIGH' ? 'success' : 'warning'}>
                    {wallet.confidenceLevel} Confidence
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-1 justify-between w-full md:w-auto grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Smart Score</p>
                <p className="font-bold text-emerald-400 text-lg">{wallet.scoreOverall} <span className="text-xs text-muted-foreground font-normal">/ 100</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Realized P&L</p>
                <p className="font-bold text-emerald-500">+${wallet.totalRealizedPnl.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className="font-semibold">{wallet.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Risk Profile</p>
                <p className="font-semibold flex items-center gap-1">
                  {wallet.scoreRisk > 70 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                  {wallet.scoreRisk > 70 ? 'High' : wallet.scoreRisk > 40 ? 'Medium' : 'Low'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none">Follow</Button>
              <Button className="flex-1 md:flex-none bg-primary text-primary-foreground hover:bg-primary/90">Copy</Button>
            </div>
            
          </Card>
        ))}
      </div>
    </div>
  );
}
