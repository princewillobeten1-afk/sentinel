/**
 * Observability Alerting & Incident Escalation Engine (Sprint 32 §26).
 *
 * Implements actionable, prioritized, and non-duplicative alerting:
 *   - Priority tiers: P1_CRITICAL (immediate page), P2_HIGH, P3_MEDIUM, P4_LOW
 *   - Rolling deduplication window to eliminate alert storms and notification fatigue
 *   - Runbook linkage for rapid incident triage
 */

import { structuredLogger } from './structured-logger';

export type AlertPriority = 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM' | 'P4_LOW';

export interface AlertInput {
  fingerprint: string; // unique key for deduplication e.g. "rpc_outage_mainnet"
  priority: AlertPriority;
  service: string;
  summary: string;
  details?: Record<string, unknown>;
  runbookUrl?: string;
}

export interface ActiveAlert {
  id: string;
  fingerprint: string;
  priority: AlertPriority;
  service: string;
  summary: string;
  details?: Record<string, unknown>;
  runbookUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  acknowledged: boolean;
}

const activeAlerts = new Map<string, ActiveAlert>();
const DEDUPLICATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function emitAlert(input: AlertInput, now: number = Date.now()): ActiveAlert {
  const existing = activeAlerts.get(input.fingerprint);
  const nowIso = new Date(now).toISOString();

  if (existing) {
    const timeSinceLast = now - new Date(existing.lastSeenAt).getTime();
    if (timeSinceLast < DEDUPLICATION_WINDOW_MS) {
      existing.occurrenceCount++;
      existing.lastSeenAt = nowIso;
      // Deduplicated: do not log spam or re-page
      return existing;
    }
  }

  const alert: ActiveAlert = {
    id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    fingerprint: input.fingerprint,
    priority: input.priority,
    service: input.service,
    summary: input.summary,
    details: input.details,
    runbookUrl: input.runbookUrl,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    occurrenceCount: 1,
    acknowledged: false,
  };

  activeAlerts.set(input.fingerprint, alert);

  // Log as structured log
  const logLevel = input.priority === 'P1_CRITICAL' ? 'CRITICAL' : input.priority === 'P2_HIGH' ? 'ERROR' : 'WARN';
  structuredLogger.log(logLevel, `[ALERT ${input.priority}] ${input.summary}`, {
    service: input.service,
    event: 'SYSTEM_ALERT',
    metadata: {
      alertId: alert.id,
      priority: alert.priority,
      fingerprint: alert.fingerprint,
      runbookUrl: alert.runbookUrl,
      ...input.details,
    },
  });

  return alert;
}

export function getActiveAlerts(): ActiveAlert[] {
  return Array.from(activeAlerts.values()).sort((a, b) => {
    const priorityWeight: Record<AlertPriority, number> = {
      P1_CRITICAL: 4,
      P2_HIGH: 3,
      P3_MEDIUM: 2,
      P4_LOW: 1,
    };
    return priorityWeight[b.priority] - priorityWeight[a.priority];
  });
}

export function acknowledgeAlert(fingerprint: string): boolean {
  const alert = activeAlerts.get(fingerprint);
  if (alert) {
    alert.acknowledged = true;
    return true;
  }
  return false;
}

export function clearAlert(fingerprint: string): boolean {
  return activeAlerts.delete(fingerprint);
}

/** Test-only reset */
export function resetAlertingState(): void {
  activeAlerts.clear();
}
