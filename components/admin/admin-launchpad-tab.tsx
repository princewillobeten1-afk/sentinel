'use client';

import React from 'react';
import {
  Rocket,
  Users,
  DollarSign,
  AlertTriangle,
  Lock,
  PauseCircle,
  PlayCircle,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole } from '@/lib/admin/types';

interface AdminLaunchpadTabProps {
  currentRole: AdminRole;
  onPauseLaunch: (launchId: string, reason: string) => void;
}

const mockLaunches = [
  {
    id: 'launch_01',
    name: 'Sentinel Protocol ($SENT)',
    creator: 'Alpha Dev Team (9pQ1...4c00)',
    progressPct: 100,
    status: 'GRADUATED',
    raisedSol: 100,
    targetSol: 100,
    participantsCount: 840,
    fundingConcentrationTop10Pct: 18.4,
    riskScore: 10,
  },
  {
    id: 'launch_02',
    name: 'Cyber Guard AI ($CGAI)',
    creator: 'Cyber Core Team (3mA1...4c90)',
    progressPct: 68.5,
    status: 'LIVE',
    raisedSol: 68.5,
    targetSol: 100,
    participantsCount: 312,
    fundingConcentrationTop10Pct: 24.2,
    riskScore: 28,
  },
  {
    id: 'launch_03',
    name: 'Solana Moon Shot ($SMS)',
    creator: 'Unknown Deployer (7xK9...99a1)',
    progressPct: 14.0,
    status: 'RESTRICTED',
    raisedSol: 14.0,
    targetSol: 100,
    participantsCount: 12,
    fundingConcentrationTop10Pct: 78.4,
    riskScore: 84,
  },
];

export function AdminLaunchpadTab({ currentRole, onPauseLaunch }: AdminLaunchpadTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Live Launch Pools</span>
          <p className="text-xl font-bold text-white font-mono">14 Active</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Total SOL Committed (24h)</span>
          <p className="text-xl font-bold text-sky-400 font-mono">1,420 SOL ($213,000)</p>
        </div>
        <div className="p-4 rounded-xl bg-sentinel-900/60 border border-white/5 space-y-1">
          <span className="text-2xs text-slate-500 font-mono uppercase">Graduation Rate (30d)</span>
          <p className="text-xl font-bold text-emerald-400 font-mono">74.2%</p>
        </div>
      </div>

      <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                <th className="p-3.5">Launch Project</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Progress</th>
                <th className="p-3.5">Raised / Target</th>
                <th className="p-3.5">Unique Wallets</th>
                <th className="p-3.5">Top 10 Concentration</th>
                <th className="p-3.5">Risk Score</th>
                <th className="p-3.5 text-right">Emergency Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mockLaunches.map((lnch) => (
                <tr key={lnch.id} className="hover:bg-white/[0.02] transition">
                  <td className="p-3.5">
                    <div>
                      <p className="font-bold text-white">{lnch.name}</p>
                      <p className="text-2xs text-slate-500 font-mono">{lnch.creator}</p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant={
                        lnch.status === 'GRADUATED'
                          ? 'success'
                          : lnch.status === 'LIVE'
                          ? 'info'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {lnch.status}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{ width: `${lnch.progressPct}%` }}
                        />
                      </div>
                      <span className="text-slate-200">{lnch.progressPct}%</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-200">
                    {lnch.raisedSol} / {lnch.targetSol} SOL
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{lnch.participantsCount}</td>
                  <td className="p-3.5 font-mono">
                    <span className={lnch.fundingConcentrationTop10Pct > 50 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {lnch.fundingConcentrationTop10Pct}%
                    </span>
                  </td>
                  <td className="p-3.5 font-mono">
                    <span className={lnch.riskScore > 60 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {lnch.riskScore}/100
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {lnch.status === 'LIVE' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onPauseLaunch(lnch.id, 'Admin emergency pause on live launchpool')}
                        className="text-2xs h-7"
                      >
                        Pause Launch
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
