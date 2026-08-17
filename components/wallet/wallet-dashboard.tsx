'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Activity, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface WalletDashboardProps {
  walletName: string;
  address: string;
  balance: number;
  available: number;
  positions: number;
  riskScore: number;
  recentActivity: Array<{
    id: string;
    type: 'buy' | 'sell' | 'transfer' | 'interaction';
    description: string;
    value: string;
    timestamp: string;
  }>;
}

export function WalletDashboard({
  walletName,
  address,
  balance,
  available,
  positions,
  riskScore,
  recentActivity
}: WalletDashboardProps) {
  const getRiskColor = (score: number) => {
    if (score > 70) return 'text-destructive';
    if (score > 40) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <div className="flex flex-row items-center justify-between pb-2">
            <div>
              <h3 className="text-2xl font-bold">{walletName}</h3>
              <p className="text-sm text-muted-foreground font-mono">{address.slice(0, 8)}...{address.slice(-4)}</p>
            </div>
            <Badge variant="neutral" className="px-3 py-1">
              <Shield className={`w-4 h-4 mr-2 ${getRiskColor(riskScore)}`} />
              Risk: {riskScore}/100
            </Badge>
          </div>
          <div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <p className="text-3xl font-semibold">${balance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available</p>
                <p className="text-xl font-medium">${available.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">In Positions</p>
                <p className="text-xl font-medium">${positions.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div>
            <h3 className="text-lg flex items-center font-bold pb-2">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              Wallet Health
            </h3>
          </div>
          <div>
             <div className="space-y-3">
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Approval Exposure</span>
                 <span className="text-amber-500 font-medium">Moderate</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Concentration</span>
                 <span className="text-emerald-500 font-medium">Low</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                 <span className="text-muted-foreground">Suspicious Interactions</span>
                 <span className="text-emerald-500 font-medium">0</span>
               </div>
             </div>
          </div>
        </Card>
      </div>

      <Card>
        <div>
          <h3 className="text-lg font-bold pb-2">Recent Activity</h3>
        </div>
        <div>
          <div className="space-y-4">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${
                    act.type === 'buy' ? 'bg-emerald-500/10 text-emerald-500' :
                    act.type === 'sell' ? 'bg-rose-500/10 text-rose-500' :
                    act.type === 'transfer' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-slate-500/10 text-slate-500'
                  }`}>
                    {act.type === 'buy' ? <ArrowDownRight className="w-4 h-4" /> :
                     act.type === 'sell' ? <ArrowUpRight className="w-4 h-4" /> :
                     act.type === 'transfer' ? <ArrowUpRight className="w-4 h-4" /> :
                     <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{act.description}</p>
                    <p className="text-xs text-muted-foreground">{act.timestamp}</p>
                  </div>
                </div>
                <div className="font-semibold text-sm">
                  {act.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
