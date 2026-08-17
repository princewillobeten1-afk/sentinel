/**
 * Security & Authentication Audit Logger (Sprint 43 §44-52, §76).
 *
 * Persists security events into `security_audit_events`, applies severity classification,
 * and rigorously filters sensitive fields (passwords, private keys, raw tokens) to prevent leaks.
 */

import { dbRepository } from '../db/repository';
import { identityStore } from './identity-store';
import { SecurityAuditEvent, SecuritySeverity } from './types';
import { DbSecurityAuditEvent } from '../db/schema';
import { logger } from '../server/logger';

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'token',
  'rawtoken',
  'tokenhash',
  'secret',
  'secretkey',
  'privatekey',
  'seedphrase',
  'recoveryphrase',
  'signature',
]);

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Records a security event with automatic sanitization of sensitive values.
   */
  public async logEvent(
    action: string,
    opts: {
      userId?: string | null;
      severity?: SecuritySeverity;
      entityType?: string;
      entityId?: string | null;
      metadata?: Record<string, any>;
      ipAddress?: string | null;
      userAgent?: string | null;
    } = {}
  ): Promise<SecurityAuditEvent> {
    const id = `sec_evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const severity = opts.severity || 'INFO';
    const entityType = opts.entityType || 'auth';
    const sanitizedMetadata = opts.metadata ? this.sanitizeObject(opts.metadata) : undefined;
    const now = new Date().toISOString();

    const dbEvent: DbSecurityAuditEvent = {
      id,
      user_id: opts.userId ?? null,
      action,
      severity,
      entity_type: entityType,
      entity_id: opts.entityId ?? null,
      metadata: sanitizedMetadata,
      ip_address: opts.ipAddress ?? null,
      user_agent: opts.userAgent ?? null,
      created_at: now,
    };

    await identityStore.saveSecurityAuditEvent(dbEvent);

    if (severity === 'CRITICAL') {
      logger.error(`[AUDIT:CRITICAL] ${action} - user: ${opts.userId || 'anonymous'}`, sanitizedMetadata);
    } else if (severity === 'WARNING') {
      logger.warn(`[AUDIT:WARN] ${action} - user: ${opts.userId || 'anonymous'}`, sanitizedMetadata);
    } else {
      logger.info(`[AUDIT:INFO] ${action} - user: ${opts.userId || 'anonymous'}`);
    }

    return {
      id,
      userId: opts.userId ?? null,
      action,
      severity,
      entityType,
      entityId: opts.entityId ?? null,
      metadata: sanitizedMetadata,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      createdAt: now,
    };
  }

  /**
   * Retrieves security audit events for a user or entire system.
   */
  public async getEvents(userId?: string): Promise<SecurityAuditEvent[]> {
    const list = await identityStore.getSecurityAuditEvents(userId);
    return list.map((e) => ({
      id: e.id,
      userId: e.user_id,
      action: e.action,
      severity: e.severity,
      entityType: e.entity_type,
      entityId: e.entity_id,
      metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
      ipAddress: e.ip_address,
      userAgent: e.user_agent,
      createdAt: e.created_at,
    }));
  }

  /**
   * Recursively scrubs any keys matching security-sensitive identifiers.
   */
  public sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isSensitiveKey =
        SENSITIVE_KEYS.has(normalizedKey) ||
        normalizedKey.includes('password') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('privatekey') ||
        normalizedKey.includes('seedphrase');

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.sanitizeObject(value);
      } else if (isSensitiveKey) {
        cleaned[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        cleaned[key] = this.sanitizeObject(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}

export const auditService = AuditService.getInstance();
