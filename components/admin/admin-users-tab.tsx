'use client';

import React, { useState } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Wallet,
  Clock,
  UserCheck,
  UserX,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminRole } from '@/lib/admin/types';

interface AdminUsersTabProps {
  currentRole: AdminRole;
  onSelectUser: (userId: string) => void;
  onApplyRestriction: (userId: string, action: any, reason: string) => void;
}

const mockUsers = [
  {
    id: 'user_001',
    email: 'trader@sentinel.local',
    displayName: 'Sentinel Alpha Trader',
    role: 'user',
    status: 'active',
    walletsCount: 2,
    totalVolumeUsd: 842000,
    riskScore: 10,
    mfaActive: true,
    createdAt: '2026-07-15',
  },
  {
    id: 'user_002',
    email: 'sniper99@botnet.io',
    displayName: 'Sniper Cluster Lead',
    role: 'user',
    status: 'restricted',
    walletsCount: 8,
    totalVolumeUsd: 4200000,
    riskScore: 88,
    mfaActive: false,
    createdAt: '2026-08-10',
  },
  {
    id: 'user_003',
    email: 'creator_dev@alpha.sol',
    displayName: 'Solana Meme Deployer',
    role: 'user',
    status: 'active',
    walletsCount: 3,
    totalVolumeUsd: 180000,
    riskScore: 42,
    mfaActive: true,
    createdAt: '2026-08-01',
  },
];

export function AdminUsersTab({
  currentRole,
  onSelectUser,
  onApplyRestriction,
}: AdminUsersTabProps) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [restrictionAction, setRestrictionAction] = useState<string>('WARN');
  const [restrictionReason, setRestrictionReason] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  const filtered = mockUsers.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenRestriction = (user: any) => {
    setSelectedUser(user);
    setShowRestrictionModal(true);
  };

  const handleConfirmRestriction = () => {
    if (!selectedUser || !restrictionReason.trim()) return;
    onApplyRestriction(selectedUser.id, restrictionAction, restrictionReason);
    setShowRestrictionModal(false);
    setRestrictionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Search & Header */}
      <Panel className="p-4 bg-sentinel-900/60 border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by User ID, Email, Username, or Wallet..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
          />
        </div>
        <Badge variant="neutral" size="sm" className="font-mono text-xs shrink-0">
          Total Users: {mockUsers.length}
        </Badge>
      </Panel>

      {/* Users Directory Table */}
      <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                <th className="p-3.5">User Profile</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Risk Score</th>
                <th className="p-3.5">Wallets</th>
                <th className="p-3.5">Volume (USD)</th>
                <th className="p-3.5">MFA</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition">
                  <td className="p-3.5">
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        {user.displayName}
                      </p>
                      <p className="text-2xs text-slate-500 font-mono">{user.email} • {user.id}</p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <Badge variant={user.status === 'active' ? 'success' : 'danger'} size="sm">
                      {user.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-mono">
                    <span className={user.riskScore > 70 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {user.riskScore}/100
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{user.walletsCount} linked</td>
                  <td className="p-3.5 font-mono text-slate-200">${user.totalVolumeUsd.toLocaleString()}</td>
                  <td className="p-3.5 font-mono">
                    {user.mfaActive ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Enrolled
                      </span>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectUser(user.id)}
                      className="text-2xs h-7"
                    >
                      Investigate
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleOpenRestriction(user)}
                      className="text-2xs h-7"
                    >
                      Restrict
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* User Restriction Modal */}
      {showRestrictionModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-sentinel-900 border border-white/10 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>Apply Account Restriction: {selectedUser.displayName}</span>
              </div>
              <button onClick={() => setShowRestrictionModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Restriction Action:</label>
                <select
                  value={restrictionAction}
                  onChange={(e) => setRestrictionAction(e.target.value)}
                  className="w-full bg-sentinel-950 border border-white/10 rounded-xl px-3 py-2 text-slate-100 font-mono"
                >
                  <option value="WARN">Issue Official Warning Notice</option>
                  <option value="RESTRICT_TRADING">Restrict Trading (Exit-Only Mode)</option>
                  <option value="RESTRICT_WITHDRAWALS">Freeze Asset Outflows / Withdrawals</option>
                  <option value="RESTRICT_COPY_TRADING">Revoke Copy-Trading Mirroring</option>
                  <option value="SUSPEND">Suspend Account (Invalidate Sessions)</option>
                  <option value="TERMINATE">Permanently Terminate Account</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Mandatory Compliance Justification Reason:
                </label>
                <textarea
                  value={restrictionReason}
                  onChange={(e) => setRestrictionReason(e.target.value)}
                  placeholder="Explain why this restriction is required (logged to immutable audit log)..."
                  rows={3}
                  className="w-full bg-sentinel-950 border border-white/10 rounded-xl p-3 text-slate-100 font-mono text-xs focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button variant="ghost" size="sm" onClick={() => setShowRestrictionModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRestriction}
                disabled={!restrictionReason.trim()}
              >
                Apply & Record Audit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
