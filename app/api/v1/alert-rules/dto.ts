import type { AlertRuleRow } from '@/lib/server/db/alert-repository';

/**
 * Alert rule response DTO (Phase 4).
 *
 * Lives outside `route.ts` on purpose: a Next.js route module may only export
 * route handlers and its config, so a shared mapper cannot live there.
 *
 * Internal columns (`user_id`, `deleted_at`) are deliberately not mapped —
 * Sprint 42 §85-86: the API surface is an explicit contract, not whatever
 * happens to be in the row.
 */
export function toRuleDto(row: AlertRuleRow) {
  return {
    id: row.id,
    name: row.name,
    alertType: row.alert_type,
    status: row.status,
    category: row.category,
    severity: row.severity,
    scope: row.scope,
    conditions: row.conditions,
    channels: row.channels,
    cooldownMinutes: row.cooldown_minutes,
    isEnabled: row.enabled,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
