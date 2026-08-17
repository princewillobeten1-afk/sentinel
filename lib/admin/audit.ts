/**
 * Cryptographically Tamper-Resistant Audit Logger (Sprint 39 §2, §50-52).
 * Implements SHA-256 hash chaining, 6-point provenance, and chain verification.
 */

import { sha256 } from 'js-sha256';
import { AdminAuditEvent, AdminRole, PermissionDomain, AuditVerificationResult } from './types';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface RecordAuditInput {
  actorId: string;
  actorRole: AdminRole;
  actorDisplayName?: string;
  action: string;
  domain: PermissionDomain;
  resourceType: string;
  resourceId?: string;
  reason: string;
  ipAddress?: string;
  geoLocation?: string;
  userAgent?: string;
  sessionId?: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
  timestamp?: string;
}

export class AdminAuditService {
  private static instance: AdminAuditService;
  private logs: AdminAuditEvent[] = [];

  private constructor() {
    this.seedInitialLogs();
  }

  public static getInstance(): AdminAuditService {
    if (!AdminAuditService.instance) {
      AdminAuditService.instance = new AdminAuditService();
    }
    return AdminAuditService.instance;
  }

  /**
   * Compute the canonical SHA-256 hash of an audit event linked to its previous hash.
   */
  public static computeEventHash(previousHash: string, payload: Record<string, any>): string {
    const serialized = JSON.stringify({
      previousHash,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      action: payload.action,
      domain: payload.domain,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId ?? null,
      reason: payload.reason,
      timestamp: payload.timestamp,
      changesBefore: payload.changesBefore ?? null,
      changesAfter: payload.changesAfter ?? null,
    });

    return sha256(serialized);
  }

  /**
   * Record an immutable audit log entry.
   */
  public record(input: RecordAuditInput): AdminAuditEvent {
    const timestamp = input.timestamp || new Date().toISOString();
    const sequenceNum = this.logs.length + 1;
    const previousHash = this.logs.length > 0 ? this.logs[this.logs.length - 1].eventHash : GENESIS_HASH;

    const payloadForHash = {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      domain: input.domain,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reason: input.reason,
      timestamp,
      changesBefore: input.changesBefore,
      changesAfter: input.changesAfter,
    };

    const eventHash = AdminAuditService.computeEventHash(previousHash, payloadForHash);

    const event: AdminAuditEvent = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sequenceNum,
      previousHash,
      eventHash,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorDisplayName: input.actorDisplayName,
      action: input.action,
      domain: input.domain,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reason: input.reason,
      ipAddress: input.ipAddress || '127.0.0.1',
      geoLocation: input.geoLocation || 'Localhost/Internal',
      userAgent: input.userAgent || 'Sentinel-Admin-Client/1.0',
      sessionId: input.sessionId,
      changesBefore: input.changesBefore,
      changesAfter: input.changesAfter,
      timestamp,
    };

    this.logs.push(event);
    return event;
  }

  /**
   * Verify the cryptographic integrity of the entire audit chain from genesis to tip.
   */
  public verifyChainIntegrity(): AuditVerificationResult {
    if (this.logs.length === 0) {
      return { isValid: true, totalVerified: 0, message: 'Audit log is empty.' };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < this.logs.length; i++) {
      const event = this.logs[i];

      // Verify link to previous event
      if (event.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalVerified: i,
          brokenIndex: i,
          brokenEventId: event.id,
          message: `Chain link broken at index ${i} (ID: ${event.id}). Expected prevHash ${expectedPrevHash}, got ${event.previousHash}`,
        };
      }

      // Re-compute SHA-256 hash of this event's content
      const payload = {
        actorId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        domain: event.domain,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        reason: event.reason,
        timestamp: event.timestamp,
        changesBefore: event.changesBefore,
        changesAfter: event.changesAfter,
      };

      const computedHash = AdminAuditService.computeEventHash(expectedPrevHash, payload);
      if (computedHash !== event.eventHash) {
        return {
          isValid: false,
          totalVerified: i,
          brokenIndex: i,
          brokenEventId: event.id,
          message: `Tamper detected at index ${i} (ID: ${event.id}). Computed hash does not match recorded hash.`,
        };
      }

      expectedPrevHash = event.eventHash;
    }

    return {
      isValid: true,
      totalVerified: this.logs.length,
      message: `Audit log cryptographically verified. All ${this.logs.length} SHA-256 links intact.`,
    };
  }

  /**
   * Filter and query audit log entries.
   */
  public query(filters?: {
    actorId?: string;
    action?: string;
    domain?: PermissionDomain;
    resourceType?: string;
    resourceId?: string;
    since?: string;
    limit?: number;
  }): AdminAuditEvent[] {
    let results = [...this.logs];

    if (filters?.actorId) results = results.filter((l) => l.actorId.toLowerCase().includes(filters.actorId!.toLowerCase()));
    if (filters?.action) results = results.filter((l) => l.action.toLowerCase().includes(filters.action!.toLowerCase()));
    if (filters?.domain) results = results.filter((l) => l.domain === filters.domain);
    if (filters?.resourceType) results = results.filter((l) => l.resourceType.toLowerCase() === filters.resourceType!.toLowerCase());
    if (filters?.resourceId) results = results.filter((l) => l.resourceId === filters.resourceId);
    if (filters?.since) results = results.filter((l) => Date.parse(l.timestamp) >= Date.parse(filters.since!));

    // Return in reverse chronological order (newest first)
    const reversed = results.reverse();
    if (filters?.limit) {
      return reversed.slice(0, filters.limit);
    }
    return reversed;
  }

  public getById(id: string): AdminAuditEvent | undefined {
    return this.logs.find((l) => l.id === id);
  }

  public getTotalCount(): number {
    return this.logs.length;
  }

  /** Test-only reset */
  public reset(): void {
    this.logs = [];
    this.seedInitialLogs();
  }

  private seedInitialLogs(): void {
    const seedEvents: RecordAuditInput[] = [
      {
        actorId: 'admin_super_01',
        actorRole: 'SUPER_ADMIN',
        actorDisplayName: 'Super Admin Alpha',
        action: 'PLATFORM_BOOTSTRAP',
        domain: 'system',
        resourceType: 'system',
        resourceId: 'sentinel_core',
        reason: 'Initial platform initialization and security policy configuration',
        changesBefore: {},
        changesAfter: { version: '0.1.0', mode: 'NORMAL' },
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        actorId: 'admin_finance_01',
        actorRole: 'FINANCE',
        actorDisplayName: 'Chief Treasury Officer',
        action: 'TREASURY_RESERVE_REBALANCE',
        domain: 'finance',
        resourceType: 'treasury',
        resourceId: 'solana_vault_01',
        reason: 'Monthly reserve rebalance into liquidity protection pool',
        changesBefore: { allocatedSol: 40000 },
        changesAfter: { allocatedSol: 45210 },
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        actorId: 'admin_risk_01',
        actorRole: 'RISK_ANALYST',
        actorDisplayName: 'Risk Analyst Lead',
        action: 'TOKEN_RESTRICT_DISCOVERY',
        domain: 'tokens',
        resourceType: 'token',
        resourceId: '9pW2...8b11',
        reason: 'Detected 88% wash trading and creator sniper cluster',
        changesBefore: { status: 'ACTIVE' },
        changesAfter: { status: 'RESTRICTED' },
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        actorId: 'admin_ops_01',
        actorRole: 'TRADING_OPERATIONS',
        actorDisplayName: 'Trading Ops Duty',
        action: 'RPC_FALLOVER_ENGAGED',
        domain: 'system',
        resourceType: 'rpc_pool',
        resourceId: 'helius_primary',
        reason: 'Primary RPC provider latency exceeded 800ms threshold',
        changesBefore: { activeEndpoint: 'helius_primary' },
        changesAfter: { activeEndpoint: 'triton_secondary' },
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
    ];

    for (const seed of seedEvents) {
      this.record(seed);
    }
  }
}

export const adminAuditService = AdminAuditService.getInstance();
