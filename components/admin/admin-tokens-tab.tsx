'use client';

import React, { useState } from 'react';
import {
  Layers,
  Search,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole } from '@/lib/admin/types';

interface AdminTokensTabProps {
  currentRole: AdminRole;
  onSelectToken: (mint: string) => void;
  onUpdateTokenStatus: (mint: string, status: string, reason: string) => void;
}

const mockTokensList = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: '$SENT',
    name: 'Solana Sentinel',
    chain: 'solana',
    creator: 'Alpha Dev Team (9pQ1...4c00)',
    liquidityUsd: 1_850_000,
    volume24hUsd: 48_250_000,
    holdersCount: 4890,
    status: 'ACTIVE',
    riskScore: 12,
    exitabilityScore: 92,
    organicScore: 88,
    insiderScore: 14,
  },
  {
    address: '3mA1...4c90',
    symbol: '$CYBER',
    name: 'Cyber Core AI',
    chain: 'solana',
    creator: 'Cyber Team (3mA1...4c90)',
    liquidityUsd: 420_000,
    volume24hUsd: 6_800_000,
    holdersCount: 1420,
    status: 'ACTIVE',
    riskScore: 35,
    exitabilityScore: 78,
    organicScore: 72,
    insiderScore: 32,
  },
  {
    address: '9pW2...8b11',
    symbol: '$SOLM',
    name: 'Solana Meme',
    chain: 'solana',
    creator: 'Degen Creator (9pQ1...4c00)',
    liquidityUsd: 42_000,
    volume24hUsd: 2_400_000,
    holdersCount: 142,
    status: 'RESTRICTED',
    riskScore: 88,
    exitabilityScore: 18,
    organicScore: 26,
    insiderScore: 88,
  },
];

export function AdminTokensTab({
  currentRole,
  onSelectToken,
  onUpdateTokenStatus,
}: AdminTokensTabProps) {
  const [search, setSearch] = useState('');
  const [tokens, setTokens] = useState(mockTokensList);

  const filtered = tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.address.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleStatus = (token: any, newStatus: string) => {
    onUpdateTokenStatus(token.address, newStatus, `Admin changed status to ${newStatus}`);
    setTokens((prev) =>
      prev.map((t) => (t.address === token.address ? { ...t, status: newStatus } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Search */}
      <Panel className="p-4 bg-sentinel-900/60 border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tokens by symbol, name, or contract address..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
          />
        </div>
        <Badge variant="neutral" size="sm" className="font-mono text-xs shrink-0">
          Indexed Tokens: {tokens.length}
        </Badge>
      </Panel>

      {/* Tokens Table */}
      <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                <th className="p-3.5">Token Pair</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Risk Score</th>
                <th className="p-3.5">Exitability</th>
                <th className="p-3.5">Organic Vol</th>
                <th className="p-3.5">Insider Conc</th>
                <th className="p-3.5">Liquidity (USD)</th>
                <th className="p-3.5 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => (
                <tr key={t.address} className="hover:bg-white/[0.02] transition">
                  <td className="p-3.5">
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {t.name} <span className="text-sky-400">{t.symbol}</span>
                      </p>
                      <p className="text-2xs text-slate-500 font-mono">{t.address.slice(0, 8)}...{t.address.slice(-6)}</p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant={
                        t.status === 'ACTIVE'
                          ? 'success'
                          : t.status === 'RESTRICTED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-mono">
                    <span className={t.riskScore > 70 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {t.riskScore}/100
                    </span>
                  </td>
                  <td className="p-3.5 font-mono">
                    <span className={t.exitabilityScore < 30 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {t.exitabilityScore}/100
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-200">{t.organicScore}%</td>
                  <td className="p-3.5 font-mono">
                    <span className={t.insiderScore > 60 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {t.insiderScore}%
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-200">${t.liquidityUsd.toLocaleString()}</td>
                  <td className="p-3.5 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectToken(t.address)}
                      className="text-2xs h-7"
                    >
                      Inspect
                    </Button>
                    {t.status === 'ACTIVE' ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleToggleStatus(t, 'RESTRICTED')}
                        className="text-2xs h-7"
                      >
                        Restrict
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleToggleStatus(t, 'ACTIVE')}
                        className="text-2xs h-7 bg-emerald-600 hover:bg-emerald-500"
                      >
                        Activate
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
