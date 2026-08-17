'use client';

import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Radio,
  Search,
  Lock,
  UserCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AdminRole, TradingEmergencyMode } from '@/lib/admin/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';

interface AdminHeaderProps {
  currentRole: AdminRole;
  onRoleChange: (role: AdminRole) => void;
  emergencyMode: TradingEmergencyMode;
  onOpenEmergency: () => void;
  onOpenDualApproval: () => void;
  pendingApprovalsCount: number;
  openIncidentsCount: number;
  onQuickSearch: (query: string) => void;
}

const ROLES_LIST: AdminRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'TRADING_OPERATIONS',
  'RISK_ANALYST',
  'COMPLIANCE',
  'SUPPORT',
  'MODERATOR',
  'FINANCE',
  'ANALYST',
  'DEVELOPER',
  'READ_ONLY',
];

export function AdminHeader({
  currentRole,
  onRoleChange,
  emergencyMode,
  onOpenEmergency,
  onOpenDualApproval,
  pendingApprovalsCount,
  openIncidentsCount,
  onQuickSearch,
}: AdminHeaderProps) {
  const isEmergency = emergencyMode !== 'NORMAL';

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/5">
      {/* Title & Badge */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-400 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-wide">Platform Operations & Control Center</h1>
            <Badge variant="neutral" size="sm" className="font-mono text-2xs uppercase border-sky-500/30 text-sky-400">
              Sprint 39
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Internal nervous system — Monitor, investigate, configure, secure, and operate Project Sentinel.
          </p>
        </div>
      </div>

      {/* Global Status Controls & Role Switcher */}
      <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-start md:justify-end">
        {/* Emergency Mode Indicator & Trigger */}
        <button
          onClick={onOpenEmergency}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition shadow-sm ${
            isEmergency
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse hover:bg-rose-500/25'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${isEmergency ? 'text-rose-400 animate-ping' : 'text-emerald-400'}`} />
          <span>Mode: {emergencyMode}</span>
        </button>

        {/* Dual Approval Badge */}
        {pendingApprovalsCount > 0 && (
          <button
            onClick={onOpenDualApproval}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition"
          >
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            <span>Dual Approvals</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-2xs font-bold text-sentinel-950">
              {pendingApprovalsCount}
            </span>
          </button>
        )}

        {/* Role Selector Simulator (for testing all 11 roles) */}
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl px-2.5 py-1">
          <UserCheck className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-2xs text-slate-400 font-medium">Role:</span>
          <select
            value={currentRole}
            onChange={(e) => onRoleChange(e.target.value as AdminRole)}
            className="bg-transparent text-xs text-sky-400 font-bold focus:outline-none cursor-pointer"
          >
            {ROLES_LIST.map((r) => (
              <option key={r} value={r} className="bg-sentinel-900 text-slate-200">
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
