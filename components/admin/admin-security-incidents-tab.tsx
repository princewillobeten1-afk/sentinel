'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Plus,
  FileText,
  Filter,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SecurityIncident, IncidentSeverity, IncidentStatus, AbuseReport, AdminRole } from '@/lib/admin/types';

interface AdminSecurityIncidentsTabProps {
  currentRole: AdminRole;
  incidents: SecurityIncident[];
  abuseReports: AbuseReport[];
  onUpdateIncidentStatus: (id: string, status: IncidentStatus, note: string) => void;
  onResolveAbuseReport: (reportId: string, status: 'ACTIONED' | 'DISMISSED', resolution: string) => void;
  onCreateIncident: (severity: IncidentSeverity, title: string, desc: string, systems: string[]) => void;
}

export function AdminSecurityIncidentsTab({
  currentRole,
  incidents,
  abuseReports,
  onUpdateIncidentStatus,
  onResolveAbuseReport,
  onCreateIncident,
}: AdminSecurityIncidentsTabProps) {
  const [activeTab, setActiveTab] = useState<'incidents' | 'reports'>('incidents');
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(incidents[0] || null);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'incidents'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Security Incident Center ({incidents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'reports'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Abuse Reports & Moderation ({abuseReports.length})</span>
          </button>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            const title = prompt('Enter Incident Title:');
            const desc = prompt('Enter Incident Description:');
            if (title && desc) {
              onCreateIncident('P1', title, desc, ['TRADING_ENGINE', 'RPC_POOL']);
            }
          }}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Declare New Incident
        </Button>
      </div>

      {/* Incidents View */}
      {activeTab === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incident List */}
          <div className="lg:col-span-1 space-y-2.5">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                  selectedIncident?.id === inc.id
                    ? 'bg-sentinel-900 border-sky-500/40 shadow-lg'
                    : 'bg-sentinel-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant={inc.severity === 'P0' ? 'danger' : inc.severity === 'P1' ? 'danger' : 'warning'} size="sm" className="font-mono">
                    {inc.severity}
                  </Badge>
                  <span className="text-2xs text-slate-500 font-mono">
                    {new Date(inc.detectedAt).toLocaleTimeString()}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{inc.title}</h4>
                <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                  <span>Status: {inc.status}</span>
                  <span>{inc.assignedTeam}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Incident Detail Inspector */}
          {selectedIncident && (
            <Panel className="lg:col-span-2 p-5 bg-sentinel-900/50 border-white/5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="danger" size="sm" className="font-mono text-xs">
                      {selectedIncident.severity}
                    </Badge>
                    <span className="text-xs font-mono text-slate-400">ID: {selectedIncident.id}</span>
                  </div>
                  <h3 className="text-base font-bold text-white">{selectedIncident.title}</h3>
                </div>

                {/* Status Transitions */}
                <div className="flex items-center gap-1.5">
                  {(['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'ARCHIVED'] as IncidentStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => onUpdateIncidentStatus(selectedIncident.id, st, `Status changed to ${st}`)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold font-mono transition ${
                        selectedIncident.status === st
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-300">{selectedIncident.description}</p>

              {/* Systems & Assigned Team */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block mb-1">Affected Systems:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedIncident.affectedSystems.map((s) => (
                      <Badge key={s} variant="neutral" size="sm" className="text-2xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Assigned Team:</span>
                  <span className="text-slate-200 font-bold">{selectedIncident.assignedTeam}</span>
                </div>
              </div>

              {/* Incident Timeline */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Incident Response Timeline
                </h5>
                <div className="space-y-1.5">
                  {selectedIncident.timeline.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-300 flex items-start gap-2">
                      <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-2xs text-slate-500 font-mono block">
                          {new Date(item.timestamp).toLocaleTimeString()} • {item.author}
                        </span>
                        <p>{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Abuse Reports View */}
      {activeTab === 'reports' && (
        <Panel className="p-0 bg-sentinel-900/40 border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono text-2xs uppercase">
                  <th className="p-3.5">Report ID / Target</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Reporter</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {abuseReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3.5">
                      <div>
                        <p className="font-bold text-white">{rep.targetId}</p>
                        <p className="text-2xs text-slate-500 font-mono">{rep.id} • {rep.targetType}</p>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant="danger" size="sm" className="font-mono text-2xs">
                        {rep.category}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{rep.reporterWallet}</td>
                    <td className="p-3.5">
                      <Badge variant={rep.status === 'PENDING' ? 'warning' : 'neutral'} size="sm">
                        {rep.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">
                      {new Date(rep.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onResolveAbuseReport(rep.id, 'ACTIONED', 'Verified rug pull report - restricted token')}
                        className="text-2xs h-7"
                      >
                        Action & Restrict
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolveAbuseReport(rep.id, 'DISMISSED', 'False positive report')}
                        className="text-2xs h-7 text-slate-400"
                      >
                        Dismiss
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
