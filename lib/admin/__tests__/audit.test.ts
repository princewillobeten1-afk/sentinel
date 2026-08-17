import { describe, it, expect, beforeEach } from 'vitest';
import { adminAuditService, GENESIS_HASH, AdminAuditService } from '../audit';

describe('Cryptographically Tamper-Resistant Audit Logger (Sprint 39 §2, §50-52)', () => {
  beforeEach(() => {
    adminAuditService.reset();
  });

  it('records an audit event and links it with SHA-256 hash to previous entry', () => {
    const initialCount = adminAuditService.getTotalCount();
    const event = adminAuditService.record({
      actorId: 'admin_test_01',
      actorRole: 'ADMIN',
      action: 'TEST_ACTION',
      domain: 'system',
      resourceType: 'test_resource',
      resourceId: 'res_001',
      reason: 'Automated test execution',
      changesBefore: { val: 1 },
      changesAfter: { val: 2 },
    });

    expect(event.id).toBeDefined();
    expect(event.sequenceNum).toBe(initialCount + 1);
    expect(event.eventHash).toHaveLength(64); // SHA-256 hex string
    expect(event.previousHash).toHaveLength(64);
    expect(adminAuditService.getTotalCount()).toBe(initialCount + 1);
  });

  it('verifies cryptographic chain integrity from genesis to tip successfully', () => {
    const result = adminAuditService.verifyChainIntegrity();
    expect(result.isValid).toBe(true);
    expect(result.totalVerified).toBeGreaterThan(0);
    expect(result.brokenIndex).toBeUndefined();
  });

  it('detects tampering when an event hash or payload is illegally modified', () => {
    adminAuditService.record({
      actorId: 'admin_test_02',
      actorRole: 'SUPER_ADMIN',
      action: 'UNAUTHORIZED_MUTATION',
      domain: 'finance',
      resourceType: 'treasury',
      reason: 'Testing tampering detection',
    });

    // Artificially tamper with an in-memory record
    const logs = (adminAuditService as any).logs;
    logs[1].reason = 'TAMPERED_REASON_FORGERY';

    const verification = adminAuditService.verifyChainIntegrity();
    expect(verification.isValid).toBe(false);
    expect(verification.brokenIndex).toBe(1);
    expect(verification.message).toContain('Tamper detected');
  });

  it('queries and filters audit logs accurately by domain, actor, and action', () => {
    adminAuditService.record({
      actorId: 'special_actor_99',
      actorRole: 'RISK_ANALYST',
      action: 'FLAG_WALLET_SUSPICIOUS',
      domain: 'wallets',
      resourceType: 'wallet',
      resourceId: '9xW1...88a1',
      reason: 'Suspicious wash cluster',
    });

    const results = adminAuditService.query({ actorId: 'special_actor_99' });
    expect(results.length).toBe(1);
    expect(results[0].action).toBe('FLAG_WALLET_SUSPICIOUS');

    const domainFiltered = adminAuditService.query({ domain: 'wallets' });
    expect(domainFiltered.length).toBeGreaterThanOrEqual(1);
  });
});
