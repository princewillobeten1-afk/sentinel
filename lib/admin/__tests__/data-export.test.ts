import { describe, it, expect } from 'vitest';
import { AdminDataExportService } from '../data-export';
import { adminAuditService } from '../audit';
import { AdminRole } from '../types';

describe('Privacy-Preserving Administrative Data Exporter (Sprint 39 §73)', () => {
  it('exports audit logs in JSON format with IP masking for non-superadmin roles', () => {
    const logs = adminAuditService.query({ limit: 10 });
    const exportedJson = AdminDataExportService.exportAuditLogs(logs, 'MODERATOR', 'json');

    const parsed = JSON.parse(exportedJson);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].ipAddress).toContain('*'); // Masked for MODERATOR
  });

  it('preserves full IP address for SUPER_ADMIN role exports', () => {
    const logs = adminAuditService.query({ limit: 10 });
    const exportedJson = AdminDataExportService.exportAuditLogs(logs, 'SUPER_ADMIN', 'json');

    const parsed = JSON.parse(exportedJson);
    expect(parsed[0].ipAddress).not.toContain('*');
  });

  it('exports audit logs accurately in CSV format with headers', () => {
    const logs = adminAuditService.query({ limit: 5 });
    const exportedCsv = AdminDataExportService.exportAuditLogs(logs, 'ADMIN', 'csv');

    const lines = exportedCsv.trim().split('\n');
    expect(lines[0]).toContain('sequence,timestamp,actor,role,action');
    expect(lines.length).toBeGreaterThan(1);
  });
});
