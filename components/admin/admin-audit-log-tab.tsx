'use client';

import React, { useState } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Download,
  Filter,
  RefreshCw,
  Lock,
  Clock,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminAuditEvent, AuditVerificationResult, AdminRole } from '@/lib/admin/types';

interface AdminAuditLogTabProps {
  currentRole: AdminRole;
  logs: AdminAuditEvent[];
  integrityResult?: AuditVerificationResult;
  onVerifyIntegrity: () => void;
  onExport: (format: 'json' | 'csv') => void;
}

export function AdminAuditLogTab({
  currentRole,
  logs,
  integrityResult,
  onVerifyIntegrity,
  onExport,
}: AdminAuditLogTabProps) {
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  const filtered = logs.filter((l) => {
    const matchSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorId.toLowerCase().includes(search.toLowerCase()) ||
      (l.resourceId && l.resourceId.toLowerCase().includes(search.toLowerCase())) ||
      l.reason.toLowerCase().includes(search.toLowerCase());
    const matchDomain = selectedDomain === 'all' || l.domain === selectedDomain;
    return matchSearch && matchDomain;
  });

  return (
    <div className="space-y-6">
      {/* Cryptographic SHA-256 Chain Verification Header */}
      <Panel className="p-4 bg-sentinel-900/60 border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">SHA-256 Cryptographic Hash Chain</h3>
              <Badge variant={integrityResult?.isValid !== false ? 'success' : 'danger'} size="sm">
                {integrityResult?.isValid !== false ? 'CHAIN VERIFIED' : 'INTEGRITY ALERT'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              {integrityResult ? integrityResult.message : 'All administrative actions are sealed in an immutable append-only hash chain.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onVerifyIntegrity} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            Verify Chain
          </Button>

          <Button variant="ghost" size="sm" onClick={() => onExport('csv')} className="text-xs">
            <Download className="h-3 w-3 mr-1" />
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onExport('json')} className="text-xs">
            <Download className="h-3 w-3 mr-1" />
            Export JSON
          </Button>
        </div>
      </Panel>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit logs by Actor, Action, Resource ID, or Reason..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 shrink-0">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="bg-transparent text-xs text-sky-400 font-bold focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-sentinel-900">All Domains</option>
            <option value="system" className="bg-sentinel-900">System</option>
            <option value="tokens" className="bg-sentinel-900">Tokens</option>
            <option value="users" className="bg-sentinel-900">Users</option>
            <option value="trading" className="bg-sentinel-900">Trading</option>
            <option value="finance" className="bg-sentinel-900">Finance</option>
            <option value="security" className="bg-sentinel-900">Security</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                <th className="p-3.5">Sequence / Time</th>
                <th className="p-3.5">Actor (WHO)</th>
                <th className="p-3.5">Action & Domain (WHAT)</th>
                <th className="p-3.5">Target Resource</th>
                <th className="p-3.5">Operational Reason (WHY)</th>
                <th className="p-3.5">Origin (FROM WHERE)</th>
                <th className="p-3.5">Event Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition">
                  <td className="p-3.5 text-slate-400">
                    <span className="text-white font-bold block">#{log.sequenceNum}</span>
                    <span className="text-2xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="text-sky-300 font-bold block">{log.actorId}</span>
                    <Badge variant="neutral" size="sm" className="text-2xs mt-0.5">
                      {log.actorRole}
                    </Badge>
                  </td>
                  <td className="p-3.5">
                    <span className="text-white font-bold block">{log.action}</span>
                    <span className="text-2xs text-slate-400 uppercase">{log.domain}</span>
                  </td>
                  <td className="p-3.5 text-slate-300">
                    <span className="block font-bold">{log.resourceType}</span>
                    <span className="text-2xs text-slate-500">{log.resourceId || 'N/A'}</span>
                  </td>
                  <td className="p-3.5 text-slate-300 max-w-xs truncate" title={log.reason}>
                    {log.reason}
                  </td>
                  <td className="p-3.5 text-slate-400 text-2xs">
                    <span className="block text-slate-200">{log.ipAddress}</span>
                    <span className="text-slate-500">{log.geoLocation}</span>
                  </td>
                  <td className="p-3.5 text-slate-500 text-2xs" title={log.eventHash}>
                    {log.eventHash.slice(0, 10)}...
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
