'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Search,
  Radio,
  Users,
  Layers,
  Rocket,
  Activity,
  DollarSign,
  Sparkles,
  Sliders,
  ShieldAlert,
  FileText,
  Server,
  Lock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminOverviewTab } from '@/components/admin/admin-overview-tab';
import { AdminInvestigationWorkspace } from '@/components/admin/admin-investigation-workspace';
import { AdminEmergencySwitchboard } from '@/components/admin/admin-emergency-switchboard';
import { AdminDualApprovalModal } from '@/components/admin/admin-dual-approval-modal';
import { AdminActionSimulatorModal } from '@/components/admin/admin-action-simulator-modal';
import { AdminUsersTab } from '@/components/admin/admin-users-tab';
import { AdminTokensTab } from '@/components/admin/admin-tokens-tab';
import { AdminLaunchpadTab } from '@/components/admin/admin-launchpad-tab';
import { AdminTradingTab } from '@/components/admin/admin-trading-tab';
import { AdminTreasuryTab } from '@/components/admin/admin-treasury-tab';
import { AdminAiQualityTab } from '@/components/admin/admin-ai-quality-tab';
import { AdminFlagsConfigTab } from '@/components/admin/admin-flags-config-tab';
import { AdminSecurityIncidentsTab } from '@/components/admin/admin-security-incidents-tab';
import { AdminAuditLogTab } from '@/components/admin/admin-audit-log-tab';
import { AdminInfrastructureTab } from '@/components/admin/admin-infrastructure-tab';

import {
  AdminRole,
  TradingEmergencyMode,
  InvestigationDossier,
  InvestigationEntityType,
  SimulationResult,
} from '@/lib/admin/types';
import { adminEmergencyEngine } from '@/lib/admin/emergency';
import { adminDualApprovalEngine } from '@/lib/admin/dual-approval';
import { adminAuditService } from '@/lib/admin/audit';
import { adminHealthService } from '@/lib/admin/health';
import { adminFeatureFlagService } from '@/lib/admin/feature-flags';
import { adminConfigService } from '@/lib/admin/config';
import { adminIncidentService } from '@/lib/admin/incidents';
import { AdminInvestigationService } from '@/lib/admin/investigation';
import { AdminActionSimulator } from '@/lib/admin/simulator';
import { AdminDataExportService } from '@/lib/admin/data-export';

export function AdminView() {
  const [currentRole, setCurrentRole] = useState<AdminRole>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'investigate'
    | 'emergency'
    | 'users'
    | 'tokens'
    | 'trading'
    | 'launchpad'
    | 'treasury'
    | 'ai_quality'
    | 'config'
    | 'security'
    | 'audit'
    | 'infrastructure'
  >('overview');

  // Live state bindings
  const [emergencyState, setEmergencyState] = useState(adminEmergencyEngine.getState());
  const [pendingApprovals, setPendingApprovals] = useState(adminDualApprovalEngine.listPending());
  const [dossier, setDossier] = useState<InvestigationDossier | null>(null);
  const [auditLogs, setAuditLogs] = useState(adminAuditService.query({ limit: 100 }));
  const [integrityResult, setIntegrityResult] = useState(adminAuditService.verifyChainIntegrity());
  const [flags, setFlags] = useState(adminFeatureFlagService.getAllFlags());
  const [settings, setSettings] = useState(adminConfigService.getAllSettings());
  const [incidents, setIncidents] = useState(adminIncidentService.listIncidents());
  const [abuseReports, setAbuseReports] = useState(adminIncidentService.listAbuseReports());

  // Modals state
  const [showDualApprovalModal, setShowDualApprovalModal] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null);

  // Initial load
  useEffect(() => {
    AdminInvestigationService.investigateEntity(
      'TOKEN',
      'So11111111111111111111111111111111111111112'
    ).then((res) => setDossier(res));
  }, []);

  const refreshState = () => {
    setEmergencyState(adminEmergencyEngine.getState());
    setPendingApprovals(adminDualApprovalEngine.listPending());
    setAuditLogs(adminAuditService.query({ limit: 100 }));
    setFlags(adminFeatureFlagService.getAllFlags());
    setSettings(adminConfigService.getAllSettings());
    setIncidents(adminIncidentService.listIncidents());
    setAbuseReports(adminIncidentService.listAbuseReports());
  };

  const handleEntitySearch = async (type: InvestigationEntityType, id: string) => {
    const res = await AdminInvestigationService.investigateEntity(type, id);
    setDossier(res);
    setActiveTab('investigate');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Role Switcher & Emergency Badge */}
      <AdminHeader
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        emergencyMode={emergencyState.mode}
        onOpenEmergency={() => setActiveTab('emergency')}
        onOpenDualApproval={() => setShowDualApprovalModal(true)}
        pendingApprovalsCount={pendingApprovals.length}
        openIncidentsCount={incidents.filter((i) => i.status === 'OPEN').length}
        onQuickSearch={(q) => handleEntitySearch('TOKEN', q)}
      />

      {/* 2. Operational Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard },
          { id: 'investigate', label: 'Investigation Workspace', icon: Search },
          { id: 'emergency', label: 'Emergency Switchboard', icon: Radio, variant: emergencyState.mode !== 'NORMAL' ? 'danger' : undefined },
          { id: 'users', label: 'User Operations', icon: Users },
          { id: 'tokens', label: 'Token Moderation', icon: Layers },
          { id: 'trading', label: 'Trading Operations', icon: Activity },
          { id: 'launchpad', label: 'Launchpad', icon: Rocket },
          { id: 'treasury', label: 'Treasury & Fees', icon: DollarSign },
          { id: 'ai_quality', label: 'AI Quality & Cost', icon: Sparkles },
          { id: 'config', label: 'Flags & Settings', icon: Sliders },
          { id: 'security', label: 'Security & Abuse', icon: ShieldAlert },
          { id: 'audit', label: 'Immutable Audit', icon: FileText },
          { id: 'infrastructure', label: 'Infrastructure & RPC', icon: Server },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`}
            >
              <tab.icon className={`h-3.5 w-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content Switchboard */}
      {activeTab === 'overview' && (
        <AdminOverviewTab
          kpis={adminHealthService.getPlatformOverviewKpi()}
          services={adminHealthService.getServiceHealth()}
          alerts={adminHealthService.getCriticalAlerts()}
          feed={adminHealthService.getOperationsFeed()}
          onSelectEntity={(type, id) => handleEntitySearch(type, id)}
        />
      )}

      {activeTab === 'investigate' && dossier && (
        <AdminInvestigationWorkspace
          currentRole={currentRole}
          dossier={dossier}
          onSearch={handleEntitySearch}
          onApplyAction={(action, id, reason) => {
            adminAuditService.record({
              actorId: 'admin_duty',
              actorRole: currentRole,
              action: `ADMIN_ACTION_${action}`,
              domain: 'tokens',
              resourceType: dossier.entityType.toLowerCase(),
              resourceId: id,
              reason,
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'emergency' && (
        <AdminEmergencySwitchboard
          currentRole={currentRole}
          state={emergencyState}
          onSetMode={(mode, reason) => {
            adminEmergencyEngine.setEmergencyMode({
              mode,
              updatedBy: 'admin_duty',
              updatedByRole: currentRole,
              reason,
            });
            refreshState();
          }}
          onToggleSwitch={(key, value, reason) => {
            adminEmergencyEngine.setKillSwitch(key, value, {
              updatedBy: 'admin_duty',
              updatedByRole: currentRole,
              reason,
            });
            refreshState();
          }}
          onSimulateEscalation={(targetMode) => {
            const sim = AdminActionSimulator.simulateEmergencyEscalation({
              currentMode: emergencyState.mode,
              proposedMode: targetMode,
            });
            setActiveSimulation(sim);
            setShowSimulatorModal(true);
          }}
          onRequestDualApproval={(actionType, payload, reason) => {
            adminDualApprovalEngine.propose({
              actionType,
              payload,
              requestedBy: 'admin_duty',
              requestedByRole: currentRole,
              reason,
            });
            refreshState();
            setShowDualApprovalModal(true);
          }}
        />
      )}

      {activeTab === 'users' && (
        <AdminUsersTab
          currentRole={currentRole}
          onSelectUser={(userId) => handleEntitySearch('USER', userId)}
          onApplyRestriction={(userId, action, reason) => {
            adminIncidentService.applyUserRestriction({
              userId,
              action,
              reason,
              appliedBy: 'admin_duty',
              appliedByRole: currentRole,
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'tokens' && (
        <AdminTokensTab
          currentRole={currentRole}
          onSelectToken={(mint) => handleEntitySearch('TOKEN', mint)}
          onUpdateTokenStatus={(mint, status, reason) => {
            adminAuditService.record({
              actorId: 'admin_duty',
              actorRole: currentRole,
              action: 'TOKEN_STATUS_UPDATED',
              domain: 'tokens',
              resourceType: 'token',
              resourceId: mint,
              reason,
              changesAfter: { status },
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'trading' && (
        <AdminTradingTab onInspectOrder={(orderId) => handleEntitySearch('ORDER', orderId)} />
      )}

      {activeTab === 'launchpad' && (
        <AdminLaunchpadTab
          currentRole={currentRole}
          onPauseLaunch={(launchId, reason) => {
            adminAuditService.record({
              actorId: 'admin_duty',
              actorRole: currentRole,
              action: 'LAUNCHPAD_POOL_PAUSED',
              domain: 'launchpad',
              resourceType: 'launch_pool',
              resourceId: launchId,
              reason,
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'treasury' && (
        <AdminTreasuryTab
          currentRole={currentRole}
          onSimulateFeeChange={(currentFee, proposedFee) => {
            const sim = AdminActionSimulator.simulateFeeChange({
              currentFeePct: currentFee,
              proposedFeePct: proposedFee,
            });
            setActiveSimulation(sim);
            setShowSimulatorModal(true);
          }}
          onRequestFeeUpdate={(newFee, reason) => {
            adminDualApprovalEngine.propose({
              actionType: 'FEE_RATE_CHANGE',
              payload: { proposedFee: newFee },
              requestedBy: 'admin_duty',
              requestedByRole: currentRole,
              reason,
            });
            refreshState();
            setShowDualApprovalModal(true);
          }}
        />
      )}

      {activeTab === 'ai_quality' && (
        <AdminAiQualityTab currentRole={currentRole} />
      )}

      {activeTab === 'config' && (
        <AdminFlagsConfigTab
          currentRole={currentRole}
          flags={flags}
          settings={settings}
          onToggleFlag={(key, enabled) => {
            const flag = flags.find((f) => f.key === key);
            if (flag) {
              adminFeatureFlagService.setFlag({ ...flag, enabled }, {
                updatedBy: 'admin_duty',
                updatedByRole: currentRole,
                reason: `Admin toggled ${key} to ${enabled}`,
              });
              refreshState();
            }
          }}
          onUpdateRollout={(key, pct) => {
            const flag = flags.find((f) => f.key === key);
            if (flag) {
              adminFeatureFlagService.setFlag({ ...flag, rolloutPct: pct }, {
                updatedBy: 'admin_duty',
                updatedByRole: currentRole,
                reason: `Adjusted rollout of ${key} to ${pct}%`,
              });
              refreshState();
            }
          }}
          onUpdateSetting={(key, value, reason) => {
            adminConfigService.updateSetting(key, value, {
              updatedBy: 'admin_duty',
              updatedByRole: currentRole,
              reason,
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'security' && (
        <AdminSecurityIncidentsTab
          currentRole={currentRole}
          incidents={incidents}
          abuseReports={abuseReports}
          onUpdateIncidentStatus={(id, status, note) => {
            adminIncidentService.updateIncidentStatus({
              incidentId: id,
              status,
              updatedBy: 'admin_duty',
              updatedByRole: currentRole,
              note,
            });
            refreshState();
          }}
          onResolveAbuseReport={(reportId, status, resolution) => {
            adminIncidentService.resolveAbuseReport({
              reportId,
              status,
              resolution,
              reviewedBy: 'admin_duty',
              reviewedByRole: currentRole,
            });
            refreshState();
          }}
          onCreateIncident={(severity, title, desc, systems) => {
            adminIncidentService.createIncident({
              severity,
              title,
              description: desc,
              affectedSystems: systems,
              assignedTeam: 'Platform Security',
              createdBy: 'admin_duty',
              createdByRole: currentRole,
            });
            refreshState();
          }}
        />
      )}

      {activeTab === 'audit' && (
        <AdminAuditLogTab
          currentRole={currentRole}
          logs={auditLogs}
          integrityResult={integrityResult}
          onVerifyIntegrity={() => {
            const res = adminAuditService.verifyChainIntegrity();
            setIntegrityResult(res);
          }}
          onExport={(format) => {
            const exp = AdminDataExportService.exportAuditLogs(auditLogs, currentRole, format);
            const blob = new Blob([exp], { type: format === 'json' ? 'application/json' : 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sentinel_audit_logs_${Date.now()}.${format}`;
            a.click();
          }}
        />
      )}

      {activeTab === 'infrastructure' && (
        <AdminInfrastructureTab
          metrics={adminHealthService.getInfrastructureMetrics()}
          blockchains={adminHealthService.getBlockchainInfrastructure()}
        />
      )}

      {/* 4. Global Administrative Modals */}
      <AdminDualApprovalModal
        isOpen={showDualApprovalModal}
        onClose={() => setShowDualApprovalModal(false)}
        currentAdminId="admin_duty"
        currentRole={currentRole}
        proposals={pendingApprovals}
        onApprove={(propId) => {
          try {
            adminDualApprovalEngine.approve({
              proposalId: propId,
              approvedBy: 'admin_approver_02',
              approvedByRole: 'SUPER_ADMIN',
            });
            refreshState();
          } catch (e: any) {
            alert(e.message);
          }
        }}
        onReject={(propId, reason) => {
          try {
            adminDualApprovalEngine.reject({
              proposalId: propId,
              rejectedBy: 'admin_approver_02',
              rejectedByRole: 'SUPER_ADMIN',
              rejectionReason: reason,
            });
            refreshState();
          } catch (e: any) {
            alert(e.message);
          }
        }}
      />

      <AdminActionSimulatorModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
        simulation={activeSimulation}
      />
    </div>
  );
}
