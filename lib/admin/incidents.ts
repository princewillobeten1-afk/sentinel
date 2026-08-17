/**
 * Security Incident Response & Moderation Engine (Sprint 39 §13, §46-49, §55-56).
 * Manages P0-P3 security incidents, abuse report triaging, and user restriction enforcement.
 */

import { SecurityIncident, IncidentSeverity, IncidentStatus, AbuseReport, AdminRole } from './types';
import { adminAuditService } from './audit';

export type UserRestrictionAction =
  | 'WARN'
  | 'RESTRICT_TRADING'
  | 'RESTRICT_WITHDRAWALS'
  | 'RESTRICT_COPY_TRADING'
  | 'SUSPEND'
  | 'TERMINATE';

export interface UserRestrictionRecord {
  userId: string;
  action: UserRestrictionAction;
  reason: string;
  appliedBy: string;
  appliedByRole: AdminRole;
  appliedAt: string;
  expiresAt?: string;
  isActive: boolean;
}

export class AdminIncidentService {
  private static instance: AdminIncidentService;
  private incidents: Map<string, SecurityIncident> = new Map();
  private abuseReports: Map<string, AbuseReport> = new Map();
  private userRestrictions: Map<string, UserRestrictionRecord[]> = new Map();

  private constructor() {
    this.seedDemoIncidents();
  }

  public static getInstance(): AdminIncidentService {
    if (!AdminIncidentService.instance) {
      AdminIncidentService.instance = new AdminIncidentService();
    }
    return AdminIncidentService.instance;
  }

  // ── 1. Security Incidents (P0 - P3) ──

  public listIncidents(filters?: { severity?: IncidentSeverity; status?: IncidentStatus }): SecurityIncident[] {
    let list = Array.from(this.incidents.values());
    if (filters?.severity) list = list.filter((i) => i.severity === filters.severity);
    if (filters?.status) list = list.filter((i) => i.status === filters.status);
    return list.sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
  }

  public getIncident(id: string): SecurityIncident | undefined {
    return this.incidents.get(id);
  }

  public createIncident(opts: {
    severity: IncidentSeverity;
    title: string;
    description: string;
    affectedSystems: string[];
    assignedTeam: string;
    createdBy: string;
    createdByRole: AdminRole;
  }): SecurityIncident {
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const incident: SecurityIncident = {
      id,
      severity: opts.severity,
      status: 'OPEN',
      title: opts.title,
      description: opts.description,
      affectedSystems: opts.affectedSystems,
      affectedUsersCount: 0,
      detectedAt: now,
      assignedTeam: opts.assignedTeam,
      timeline: [{ timestamp: now, note: `Incident created by ${opts.createdBy}`, author: opts.createdBy }],
      evidence: [],
    };

    this.incidents.set(id, incident);

    adminAuditService.record({
      actorId: opts.createdBy,
      actorRole: opts.createdByRole,
      action: 'SECURITY_INCIDENT_CREATED',
      domain: 'security',
      resourceType: 'security_incident',
      resourceId: id,
      reason: opts.description,
      changesAfter: { severity: opts.severity, title: opts.title },
    });

    return incident;
  }

  public updateIncidentStatus(opts: {
    incidentId: string;
    status: IncidentStatus;
    updatedBy: string;
    updatedByRole: AdminRole;
    note: string;
  }): SecurityIncident {
    const incident = this.incidents.get(opts.incidentId);
    if (!incident) throw new Error(`Incident with ID "${opts.incidentId}" not found.`);

    const previousStatus = incident.status;
    const now = new Date().toISOString();
    incident.status = opts.status;
    incident.timeline.push({ timestamp: now, note: opts.note, author: opts.updatedBy });

    if (opts.status === 'RESOLVED' || opts.status === 'ARCHIVED') {
      incident.resolvedAt = now;
      incident.resolutionNotes = opts.note;
    }

    adminAuditService.record({
      actorId: opts.updatedBy,
      actorRole: opts.updatedByRole,
      action: 'SECURITY_INCIDENT_STATUS_UPDATED',
      domain: 'security',
      resourceType: 'security_incident',
      resourceId: incident.id,
      reason: opts.note,
      changesBefore: { status: previousStatus },
      changesAfter: { status: opts.status },
    });

    return incident;
  }

  // ── 2. User Restrictions (Warn, Restrict, Suspend, Terminate) ──

  public applyUserRestriction(opts: {
    userId: string;
    action: UserRestrictionAction;
    reason: string;
    appliedBy: string;
    appliedByRole: AdminRole;
    durationHours?: number;
  }): UserRestrictionRecord {
    const now = Date.now();
    const expiresAt = opts.durationHours ? new Date(now + opts.durationHours * 3600 * 1000).toISOString() : undefined;

    const record: UserRestrictionRecord = {
      userId: opts.userId,
      action: opts.action,
      reason: opts.reason,
      appliedBy: opts.appliedBy,
      appliedByRole: opts.appliedByRole,
      appliedAt: new Date(now).toISOString(),
      expiresAt,
      isActive: true,
    };

    const existing = this.userRestrictions.get(opts.userId) || [];
    existing.push(record);
    this.userRestrictions.set(opts.userId, existing);

    adminAuditService.record({
      actorId: opts.appliedBy,
      actorRole: opts.appliedByRole,
      action: `USER_RESTRICTION_${opts.action}`,
      domain: 'users',
      resourceType: 'user_account',
      resourceId: opts.userId,
      reason: opts.reason,
      changesAfter: { action: opts.action, expiresAt },
    });

    return record;
  }

  public getUserRestrictions(userId: string): UserRestrictionRecord[] {
    return this.userRestrictions.get(userId) || [];
  }

  // ── 3. Abuse Reports ──

  public listAbuseReports(): AbuseReport[] {
    return Array.from(this.abuseReports.values()).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }

  public resolveAbuseReport(opts: {
    reportId: string;
    status: 'ACTIONED' | 'DISMISSED';
    resolution: string;
    reviewedBy: string;
    reviewedByRole: AdminRole;
  }): AbuseReport {
    const report = this.abuseReports.get(opts.reportId);
    if (!report) throw new Error(`Abuse report "${opts.reportId}" not found.`);

    report.status = opts.status;
    report.resolution = opts.resolution;
    report.reviewedBy = opts.reviewedBy;

    adminAuditService.record({
      actorId: opts.reviewedBy,
      actorRole: opts.reviewedByRole,
      action: `ABUSE_REPORT_${opts.status}`,
      domain: 'security',
      resourceType: 'abuse_report',
      resourceId: report.id,
      reason: opts.resolution,
    });

    return report;
  }

  public reset(): void {
    this.incidents.clear();
    this.abuseReports.clear();
    this.userRestrictions.clear();
    this.seedDemoIncidents();
  }

  private seedDemoIncidents(): void {
    const now = Date.now();
    this.incidents.set('inc_demo_01', {
      id: 'inc_demo_01',
      severity: 'P1',
      status: 'INVESTIGATING',
      title: 'Triton Solana RPC Latency Degradation',
      description: 'Secondary RPC pool latency spiked to 1,400ms causing intermittent trade simulation timeouts.',
      affectedSystems: ['RPC_POOL', 'TRADING_ENGINE'],
      affectedUsersCount: 142,
      detectedAt: new Date(now - 3600000 * 2).toISOString(),
      assignedTeam: 'Infrastructure Ops',
      timeline: [
        {
          timestamp: new Date(now - 3600000 * 2).toISOString(),
          note: 'Automated alarm triggered on elevated 99th percentile RPC latency',
          author: 'system_monitor',
        },
        {
          timestamp: new Date(now - 3600000 * 1.8).toISOString(),
          note: 'Failover engaged; traffic shifted to primary Helius node pool',
          author: 'admin_ops_01',
        },
      ],
      evidence: [],
    });

    this.abuseReports.set('rep_demo_01', {
      id: 'rep_demo_01',
      reporterWallet: '4zW8...9kL2',
      targetType: 'TOKEN',
      targetId: '9pW2...8b11',
      category: 'RUG_PULL',
      evidence: { details: 'Deployer dumped 40% initial supply in slot 2948140' },
      status: 'PENDING',
      createdAt: new Date(now - 3600000 * 1).toISOString(),
    });
  }
}

export const adminIncidentService = AdminIncidentService.getInstance();
