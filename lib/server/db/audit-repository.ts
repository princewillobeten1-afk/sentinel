import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import type { AuditLogEntry } from '@/lib/server/store';

interface AuditEventRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function rowToEntry(row: AuditEventRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: new Date(row.created_at).toISOString(),
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: row.metadata ?? undefined,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}

/**
 * Postgres-backed replacement for `ServerStore`'s capped in-memory audit
 * array, using the pre-existing `security_audit_events` table
 * (020_auth_identity_wallet_system.sql — a better field match than 013's
 * generic `audit_logs`). A real table doesn't need the in-memory 500-item
 * cap; reads accept an optional `limit` instead (default 500, matching prior
 * behavior) rather than the store silently discarding old entries on write.
 */
export class PgAuditRepository {
  async recordAuditLog(log: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
    const id = generateId('aud');
    const { rows } = await dbPool.query<AuditEventRow>(
      `INSERT INTO security_audit_events (id, user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        log.userId ?? null,
        log.action,
        log.entityType,
        log.entityId ?? null,
        log.changes ? JSON.stringify(log.changes) : null,
        log.ipAddress ?? null,
        log.userAgent ?? null,
        log.timestamp,
      ],
    );
    return rowToEntry(rows[0] as AuditEventRow);
  }

  async getAuditLogs(filter?: { userId?: string; action?: string; since?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.userId) {
      params.push(filter.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (filter?.action) {
      params.push(filter.action);
      conditions.push(`action = $${params.length}`);
    }
    if (filter?.since) {
      params.push(filter.since);
      conditions.push(`created_at >= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filter?.limit ?? 500);

    const { rows } = await dbPool.query<AuditEventRow>(
      `SELECT * FROM security_audit_events ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map(rowToEntry);
  }
}

export const pgAuditRepository = new PgAuditRepository();
