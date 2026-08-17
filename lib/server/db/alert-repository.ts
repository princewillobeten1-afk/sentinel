import 'server-only';

import { dbPool } from './pool';
import { generateId } from '@/lib/server/id';
import { ApiError } from '@/lib/server/errors';
import {
  assertAlertRuleTransition,
  assertReadStateTransition,
  type AlertRuleState,
  type AlertEventReadState,
} from '@/lib/alert/rule-state-machine';

/** Postgres-backed alert rules + events (Phase 4). Tables from 013, extended by 025. */

export interface AlertRuleRow {
  id: string;
  user_id: string;
  alert_type: string;
  name: string;
  enabled: boolean;
  status: AlertRuleState;
  category: string | null;
  severity: string | null;
  scope: Record<string, unknown>;
  conditions: Record<string, unknown>;
  channels: string[];
  cooldown_minutes: number;
  deleted_at: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertEventRow {
  id: string;
  alert_id: string;
  user_id: string | null;
  triggered_at: string;
  payload: Record<string, unknown>;
  status: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  category: string | null;
  token_symbol: string | null;
  read_state: AlertEventReadState;
}

export interface CreateAlertRuleInput {
  userId: string;
  name: string;
  alertType: string;
  category?: string | null;
  severity?: string | null;
  scope?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  channels?: string[];
  cooldownMinutes?: number;
}

export class PgAlertRepository {
  // ── Rules ────────────────────────────────────────────────────────────────
  async createRule(input: CreateAlertRuleInput): Promise<AlertRuleRow> {
    return dbPool.withTransaction(async (client) => {
      const id = generateId('alr');
      const { rows } = await client.query<AlertRuleRow>(
        `INSERT INTO alerts (id, user_id, alert_type, name, enabled, status, category, severity,
                             scope, conditions, channels, cooldown_minutes)
         VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, TRUE, 'ACTIVE', $5::varchar, $6::varchar,
                 COALESCE($7::jsonb, '{}'::jsonb), COALESCE($8::jsonb, '{}'::jsonb),
                 COALESCE($9::jsonb, '[]'::jsonb), COALESCE($10::integer, 0))
         RETURNING *`,
        [
          id,
          input.userId,
          input.alertType,
          input.name,
          input.category ?? null,
          input.severity ?? null,
          input.scope ? JSON.stringify(input.scope) : null,
          input.conditions ? JSON.stringify(input.conditions) : null,
          input.channels ? JSON.stringify(input.channels) : null,
          input.cooldownMinutes ?? null,
        ],
      );
      await client.query(
        `INSERT INTO alert_rule_transitions (id, alert_id, from_state, to_state, reason)
         VALUES ($1::varchar, $2::varchar, NULL, 'ACTIVE', 'Rule created')`,
        [generateId('art'), id],
      );
      return rows[0];
    });
  }

  /** Excludes soft-deleted rules unless explicitly asked. */
  async listRules(userId: string, opts: { limit: number; offset: number; includeDeleted?: boolean } ): Promise<AlertRuleRow[]> {
    const { rows } = await dbPool.query<AlertRuleRow>(
      `SELECT * FROM alerts
       WHERE user_id = $1 ${opts.includeDeleted ? '' : "AND status != 'DELETED'"}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, opts.limit, opts.offset],
    );
    return rows;
  }

  async countRules(userId: string, includeDeleted = false): Promise<number> {
    const { rows } = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM alerts WHERE user_id = $1 ${includeDeleted ? '' : "AND status != 'DELETED'"}`,
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getRuleForUser(ruleId: string, userId: string): Promise<AlertRuleRow | undefined> {
    const { rows } = await dbPool.query<AlertRuleRow>(
      'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
      [ruleId, userId],
    );
    return rows[0];
  }

  async updateRule(
    ruleId: string,
    userId: string,
    updates: { name?: string; severity?: string; channels?: string[]; cooldownMinutes?: number; conditions?: Record<string, unknown>; scope?: Record<string, unknown> },
  ): Promise<AlertRuleRow> {
    const { rows } = await dbPool.query<AlertRuleRow>(
      `UPDATE alerts SET
         name = COALESCE($3::varchar, name),
         severity = COALESCE($4::varchar, severity),
         channels = COALESCE($5::jsonb, channels),
         cooldown_minutes = COALESCE($6::integer, cooldown_minutes),
         conditions = COALESCE($7::jsonb, conditions),
         scope = COALESCE($8::jsonb, scope),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        ruleId,
        userId,
        updates.name ?? null,
        updates.severity ?? null,
        updates.channels ? JSON.stringify(updates.channels) : null,
        updates.cooldownMinutes ?? null,
        updates.conditions ? JSON.stringify(updates.conditions) : null,
        updates.scope ? JSON.stringify(updates.scope) : null,
      ],
    );
    if (!rows[0]) throw new ApiError('Alert rule not found', 404, 'ALERT_NOT_FOUND');
    return rows[0];
  }

  /** Locked read + validated transition + history row, all in one transaction. */
  async transitionRule(ruleId: string, to: AlertRuleState, reason?: string): Promise<AlertRuleRow> {
    return dbPool.withTransaction(async (client) => {
      const { rows: locked } = await client.query<AlertRuleRow>(
        'SELECT * FROM alerts WHERE id = $1 FOR UPDATE',
        [ruleId],
      );
      const current = locked[0];
      if (!current) throw new ApiError('Alert rule not found', 404, 'ALERT_NOT_FOUND');

      assertAlertRuleTransition(current.status, to);

      const { rows } = await client.query<AlertRuleRow>(
        `UPDATE alerts SET
           status = $2::varchar,
           enabled = ($2::varchar = 'ACTIVE'),
           deleted_at = CASE WHEN $2::varchar = 'DELETED' THEN NOW() ELSE deleted_at END,
           last_triggered_at = CASE WHEN $2::varchar = 'TRIGGERED' THEN NOW() ELSE last_triggered_at END,
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [ruleId, to],
      );
      await client.query(
        `INSERT INTO alert_rule_transitions (id, alert_id, from_state, to_state, reason)
         VALUES ($1::varchar, $2::varchar, $3::varchar, $4::varchar, $5::text)`,
        [generateId('art'), ruleId, current.status, to, reason ?? null],
      );
      return rows[0];
    });
  }

  // ── Events ───────────────────────────────────────────────────────────────
  async recordEvent(input: {
    alertId: string;
    userId: string;
    title: string;
    summary?: string | null;
    severity?: string | null;
    category?: string | null;
    tokenSymbol?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<AlertEventRow> {
    const { rows } = await dbPool.query<AlertEventRow>(
      `INSERT INTO alert_events (id, alert_id, user_id, payload, status, title, summary, severity, category, token_symbol, read_state)
       VALUES ($1::varchar, $2::varchar, $3::varchar, COALESCE($4::jsonb, '{}'::jsonb), 'triggered',
               $5::varchar, $6::text, $7::varchar, $8::varchar, $9::varchar, 'UNREAD')
       RETURNING *`,
      [
        generateId('ale'),
        input.alertId,
        input.userId,
        input.payload ? JSON.stringify(input.payload) : null,
        input.title,
        input.summary ?? null,
        input.severity ?? null,
        input.category ?? null,
        input.tokenSymbol ?? null,
      ],
    );
    return rows[0];
  }

  async listEvents(
    userId: string,
    opts: { limit: number; offset: number; severity?: string; readState?: AlertEventReadState },
  ): Promise<AlertEventRow[]> {
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = $1';
    if (opts.severity) {
      params.push(opts.severity);
      where += ` AND severity = $${params.length}`;
    }
    if (opts.readState) {
      params.push(opts.readState);
      where += ` AND read_state = $${params.length}`;
    }
    params.push(opts.limit, opts.offset);
    const { rows } = await dbPool.query<AlertEventRow>(
      `SELECT * FROM alert_events ${where} ORDER BY triggered_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows;
  }

  async countEvents(userId: string, severity?: string, readState?: AlertEventReadState): Promise<number> {
    const params: unknown[] = [userId];
    let where = 'WHERE user_id = $1';
    if (severity) {
      params.push(severity);
      where += ` AND severity = $${params.length}`;
    }
    if (readState) {
      params.push(readState);
      where += ` AND read_state = $${params.length}`;
    }
    const { rows } = await dbPool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM alert_events ${where}`,
      params,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async getEventForUser(eventId: string, userId: string): Promise<AlertEventRow | undefined> {
    const { rows } = await dbPool.query<AlertEventRow>(
      'SELECT * FROM alert_events WHERE id = $1 AND user_id = $2',
      [eventId, userId],
    );
    return rows[0];
  }

  async setReadState(eventId: string, userId: string, to: AlertEventReadState): Promise<AlertEventRow> {
    return dbPool.withTransaction(async (client) => {
      const { rows: locked } = await client.query<AlertEventRow>(
        'SELECT * FROM alert_events WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [eventId, userId],
      );
      const current = locked[0];
      if (!current) throw new ApiError('Alert not found', 404, 'ALERT_NOT_FOUND');

      assertReadStateTransition(current.read_state, to);

      const { rows } = await client.query<AlertEventRow>(
        'UPDATE alert_events SET read_state = $2::varchar WHERE id = $1 RETURNING *',
        [eventId, to],
      );
      return rows[0];
    });
  }
}

export const pgAlertRepository = new PgAlertRepository();
