/**
 * Privacy-Preserving Admin Data Export Engine (Sprint 39 §73-74).
 * Exports Analytics, Transactions, Users, and Audit Logs with role-based PII redaction.
 */

import { AdminRole } from './types';

export class AdminDataExportService {
  /**
   * Export audit log records with PII masking based on requesting admin role.
   */
  public static exportAuditLogs(logs: any[], requestingRole: AdminRole, format: 'json' | 'csv' = 'json'): string {
    const isPrivileged = requestingRole === 'SUPER_ADMIN' || requestingRole === 'COMPLIANCE';

    const sanitized = logs.map((log) => ({
      sequence: log.sequenceNum,
      timestamp: log.timestamp,
      actor: isPrivileged ? log.actorId : this.maskIdentifier(log.actorId),
      role: log.actorRole,
      action: log.action,
      domain: log.domain,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      reason: log.reason,
      ipAddress: isPrivileged ? log.ipAddress : this.maskIp(log.ipAddress),
      eventHash: log.eventHash,
      previousHash: log.previousHash,
    }));

    if (format === 'csv') {
      return this.toCsv(sanitized);
    }
    return JSON.stringify(sanitized, null, 2);
  }

  /**
   * Export user roster with PII redaction.
   */
  public static exportUsers(users: any[], requestingRole: AdminRole, format: 'json' | 'csv' = 'json'): string {
    const isPrivileged = requestingRole === 'SUPER_ADMIN' || requestingRole === 'COMPLIANCE';

    const sanitized = users.map((u) => ({
      userId: u.id,
      email: isPrivileged ? u.email : this.maskEmail(u.email),
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
    }));

    if (format === 'csv') {
      return this.toCsv(sanitized);
    }
    return JSON.stringify(sanitized, null, 2);
  }

  private static maskEmail(email?: string): string {
    if (!email) return 'N/A';
    const parts = email.split('@');
    if (parts.length < 2) return '***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
  }

  private static maskIp(ip?: string): string {
    if (!ip) return '***';
    const segments = ip.split('.');
    if (segments.length === 4) {
      return `${segments[0]}.${segments[1]}.*.*`;
    }
    return '***';
  }

  private static maskIdentifier(id?: string): string {
    if (!id) return '***';
    if (id.length <= 6) return '***';
    return `${id.slice(0, 3)}...${id.slice(-3)}`;
  }

  private static toCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];

    for (const row of rows) {
      const values = headers.map((h) => {
        const val = row[h] === undefined || row[h] === null ? '' : String(row[h]);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }
}
