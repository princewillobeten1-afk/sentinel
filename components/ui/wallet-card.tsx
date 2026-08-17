import React from 'react';
import { clsx } from 'clsx';
import { Wallet, Copy, ExternalLink, Activity, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface WalletCardData {
  address: string;
  label: string;
  balanceSol: number;
  balanceUsd: string;
  reputation: 'Smart Money' | 'Insider' | 'Whale' | 'Degen' | 'Normal';
  winRate: string;
  recentActivity: string;
}

export interface WalletCardProps {
  wallet: WalletCardData;
  onCopy?: () => void;
  className?: string;
}

export function WalletCard({ wallet, onCopy, className }: WalletCardProps) {
  const { address, label, balanceSol, balanceUsd, reputation, winRate, recentActivity } = wallet;

  return (
    <div className={clsx('rounded-xl border border-sentinel-700/80 bg-sentinel-850 p-4 shadow-card hover:border-sentinel-600 transition space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-750 text-sky-400 font-bold border border-sentinel-600">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-xs">{label}</h4>
            <p className="text-2xs text-slate-400 font-numeric flex items-center gap-1">
              <span>{address}</span>
              {onCopy && <Copy onClick={onCopy} className="h-2.5 w-2.5 cursor-pointer hover:text-white" />}
            </p>
          </div>
        </div>

        <Badge variant={reputation === 'Smart Money' ? 'risk-low' : reputation === 'Whale' ? 'info' : 'neutral'} size="sm">
          {reputation}
        </Badge>
      </div>

      <div className="flex items-baseline justify-between font-numeric pt-1 bg-sentinel-950 p-2.5 rounded-lg border border-sentinel-800">
        <div>
          <span className="text-2xs text-slate-500 uppercase block font-mono">Balance</span>
          <span className="text-sm font-bold text-white">{balanceSol} SOL <span className="text-xs text-slate-400 font-normal">({balanceUsd})</span></span>
        </div>
        <div className="text-right">
          <span className="text-2xs text-slate-500 uppercase block font-mono">Win Rate</span>
          <span className="text-xs font-bold text-emerald-400">{winRate}</span>
        </div>
      </div>

      <div className="text-2xs text-slate-300 font-mono flex items-center gap-1.5 pt-1">
        <Activity className="h-3 w-3 text-sky-400 shrink-0" />
        <span className="truncate">{recentActivity}</span>
      </div>
    </div>
  );
}
