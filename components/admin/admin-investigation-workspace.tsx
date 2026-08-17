'use client';

import React, { useState } from 'react';
import {
  Search,
  BrainCircuit,
  Share2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Lock,
  Eye,
  Sliders,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Layers,
  Activity,
  User,
  Wallet,
} from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvestigationDossier, InvestigationEntityType, AdminRole } from '@/lib/admin/types';
import { AdminRelationshipGraph } from './admin-relationship-graph';
import { AdminAiAssistantPanel } from './admin-ai-assistant-panel';

interface AdminInvestigationWorkspaceProps {
  currentRole: AdminRole;
  dossier: InvestigationDossier;
  onSearch: (type: InvestigationEntityType, id: string) => void;
  onApplyAction: (action: string, entityId: string, reason: string) => void;
}

export function AdminInvestigationWorkspace({
  currentRole,
  dossier,
  onSearch,
  onApplyAction,
}: AdminInvestigationWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState(dossier.entityId);
  const [selectedType, setSelectedType] = useState<InvestigationEntityType>(dossier.entityType);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'graph' | 'ai' | 'evidence' | 'notes'>('timeline');
  const [actionReason, setActionReason] = useState('');
  const [newNote, setNewNote] = useState('');

  const handleExecuteSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onSearch(selectedType, searchQuery.trim());
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Omnibox Search Bar */}
      <Panel className="p-4 bg-sentinel-900/60 border-white/10 backdrop-blur-xl">
        <form onSubmit={handleExecuteSearch} className="flex flex-col sm:flex-row items-center gap-3">
          {/* Entity Type Selector */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 shrink-0">
            <span className="text-xs text-slate-400 font-medium">Target:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as InvestigationEntityType)}
              className="bg-transparent text-xs text-sky-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="TOKEN" className="bg-sentinel-900">Token Mint</option>
              <option value="WALLET" className="bg-sentinel-900">Wallet Address</option>
              <option value="USER" className="bg-sentinel-900">User Profile</option>
              <option value="CREATOR" className="bg-sentinel-900">Creator Dossier</option>
              <option value="ORDER" className="bg-sentinel-900">Order ID / Tx</option>
              <option value="INCIDENT" className="bg-sentinel-900">Incident ID</option>
            </select>
          </div>

          {/* Search Input Box */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token address, wallet, creator, order ID, or transaction hash..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition font-mono"
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" size="sm" className="shrink-0 w-full sm:w-auto">
            Deep Investigate
          </Button>
        </form>
      </Panel>

      {/* 2. 360° Entity Header & Risk Banner */}
      <Panel className="p-5 bg-sentinel-900/40 border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-lg font-bold text-white tracking-wide">{dossier.title}</h2>
              <Badge
                variant={
                  dossier.riskLevel === 'CRITICAL'
                    ? 'danger'
                    : dossier.riskLevel === 'HIGH'
                    ? 'danger'
                    : dossier.riskLevel === 'MODERATE'
                    ? 'warning'
                    : 'success'
                }
                size="sm"
                className="font-mono text-2xs"
              >
                RISK: {dossier.riskScore}/100 ({dossier.riskLevel})
              </Badge>
              <Badge variant="neutral" size="sm" className="font-mono text-2xs">
                STATUS: {dossier.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span>ID: {dossier.entityId}</span>
              <span>•</span>
              <span>Type: {dossier.entityType}</span>
            </p>
          </div>

          {/* Signal Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {dossier.detectedSignals.map((sig) => (
              <Badge key={sig} variant="neutral" size="sm" className="text-2xs font-mono border-white/10 text-slate-300">
                {sig}
              </Badge>
            ))}
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5">
          {Object.entries(dossier.summary).slice(0, 8).map(([key, val]) => (
            <div key={key} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-2xs text-slate-500 font-mono uppercase">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-xs font-bold text-slate-200 truncate mt-0.5">
                {typeof val === 'number' ? (val > 1000 ? val.toLocaleString() : val) : String(val)}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* 3. Investigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('timeline')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'timeline'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Timeline & Events ({dossier.timeline.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('graph')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'graph'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Relationship Graph</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ai')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'ai'
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>AI Assistant & Citations</span>
        </button>

        <button
          onClick={() => setActiveSubTab('evidence')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'evidence'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Raw Evidence ({dossier.evidence.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('notes')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            activeSubTab === 'notes'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Admin Notes & Actions</span>
        </button>
      </div>

      {/* 4. Sub-Tab Content */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-3">
          {dossier.timeline.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No timeline events recorded for this entity.</p>
          ) : (
            dossier.timeline.map((evt, idx) => (
              <div
                key={evt.id}
                className="flex items-start gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition"
              >
                <div className="flex flex-col items-center mt-1">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      evt.severity === 'CRITICAL'
                        ? 'bg-rose-500'
                        : evt.severity === 'ALERT'
                        ? 'bg-amber-500'
                        : 'bg-sky-400'
                    }`}
                  />
                  {idx < dossier.timeline.length - 1 && <div className="w-0.5 h-10 bg-white/10 my-1" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{evt.title}</h4>
                    <span className="text-2xs font-mono text-slate-500">{evt.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400">{evt.description}</p>
                  <Badge variant="neutral" size="sm" className="text-2xs font-mono">
                    SRC: {evt.source}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'graph' && (
        <AdminRelationshipGraph entityId={dossier.entityId} entityType={dossier.entityType} />
      )}

      {activeSubTab === 'ai' && (
        <AdminAiAssistantPanel contextId={dossier.entityId} />
      )}

      {activeSubTab === 'evidence' && (
        <div className="space-y-3">
          {dossier.evidence.map((ev) => (
            <div key={ev.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="info" size="sm" className="text-2xs font-mono">
                    {ev.type}
                  </Badge>
                  <span className="text-xs font-bold text-white font-mono">{ev.reference}</span>
                </div>
                <Badge variant={ev.verified ? 'success' : 'warning'} size="sm">
                  {ev.verified ? 'VERIFIED ON-CHAIN' : 'CALCULATED MODEL'}
                </Badge>
              </div>
              <p className="text-xs text-slate-300">{ev.details}</p>
              <p className="text-2xs text-slate-500 font-mono">Timestamp: {ev.timestamp}</p>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'notes' && (
        <div className="space-y-6">
          {/* Action Toolbox */}
          <Panel className="p-4 bg-sentinel-900/60 border-white/5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              Controlled Administrative Actions (Requires Reason)
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => onApplyAction('RESTRICT_TRADING', dossier.entityId, actionReason || 'Suspicious risk cluster detected')}
              >
                Restrict Trading
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApplyAction('HIDE_DISCOVERY', dossier.entityId, actionReason || 'Delisted from discover feeds')}
              >
                Hide From Discovery
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApplyAction('FLAG_WALLET', dossier.entityId, actionReason || 'Flagged for insider sniper activity')}
              >
                Flag Entity
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onApplyAction('SUSPEND_USER', dossier.entityId, actionReason || 'Compliance violation')}
              >
                Suspend Account
              </Button>
            </div>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter mandatory justification reason for this administrative action..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 transition"
            />
          </Panel>

          {/* Existing Notes */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300">Admin Investigation Notes</h4>
            {dossier.adminNotes.length === 0 ? (
              <p className="text-xs text-slate-500">No notes recorded yet.</p>
            ) : (
              dossier.adminNotes.map((n, i) => (
                <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
                    <span className="font-bold text-sky-400">{n.author}</span>
                    <span>{n.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-200">{n.note}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
