import { serverStore } from './store';
import { logger } from './logger';

export interface AuditEventInput {
  userId?: string | null;
  action:
    | 'AUTH_CHALLENGE_CREATED'
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILED'
    | 'WALLET_CONNECTED'
    | 'WALLET_VERIFIED'
    | 'WALLET_REMOVED'
    | 'PRIMARY_WALLET_CHANGED'
    | 'SESSION_REVOKED'
    | 'SESSION_REVOKED_ALL'
    | 'LOGOUT'
    | 'ACCOUNT_DEACTIVATED'
    | 'MFA_ENROLLED'
    | 'MFA_DISABLED'
    | 'MFA_CHALLENGE_FAILED'
    | 'BACKUP_CODE_USED'
    | 'NEW_DEVICE_LOGIN'
    | 'ROLE_CHANGED'
    | 'KILL_SWITCH_PROPOSED'
    | 'KILL_SWITCH_APPROVED'
    | 'KILL_SWITCH_REJECTED'
    | 'KILL_SWITCH_TRIGGERED'
    | 'KILL_SWITCH_RESET'
    | 'CIRCUIT_BREAKER_TRIGGERED'
    | 'CIRCUIT_BREAKER_RESET'
    | 'TRADE_BLOCKED_BY_RISK_ENGINE'
    | 'WALLET_WITHDRAWAL_RECORDED';
  entityType: 'user' | 'wallet' | 'challenge' | 'session' | 'mfa' | 'kill_switch' | 'approval_request';
  entityId?: string | null;
  changes?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Deliberately fire-and-forget: audit logging must never block or fail the
 * caller's primary request path. `serverStore.recordAuditLog` is async
 * (Phase 1 — Postgres Foundation) but its result isn't awaited here; a
 * write failure is logged, not thrown, so callers keep their existing
 * synchronous call sites unchanged.
 */
export function recordAuditEvent(event: AuditEventInput): void {
  const logData = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  logger.info(`[AUDIT] ${event.action}`, logData);
  serverStore.recordAuditLog(logData).catch((err) => {
    logger.error('[audit] failed to persist audit log', { message: err instanceof Error ? err.message : String(err) });
  });
}
