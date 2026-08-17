import { describe, it, expect, beforeEach } from 'vitest';
import { dbRepository } from '@/lib/db/repository';
import { auditService } from '@/lib/auth/audit-service';

describe('AuditService - Security Logging & Secret Redaction', () => {
  beforeEach(async () => {
    dbRepository.reset();
  });

  it('records security events with appropriate severity classifications', async () => {
    await auditService.logEvent('user.registered', {
      userId: 'usr_123',
      severity: 'INFO',
      metadata: { email: 'trader@sentinel.market' },
    });

    await auditService.logEvent('user.login_failed', {
      userId: 'usr_123',
      severity: 'WARNING',
      metadata: { reason: 'BAD_PASSWORD' },
    });

    await auditService.logEvent('account.suspended', {
      userId: 'usr_123',
      severity: 'CRITICAL',
      metadata: { riskScore: 98 },
    });

    const events = await auditService.getEvents('usr_123');
    expect(events.length).toBe(3);
    expect(events.map((e) => e.severity)).toEqual(['INFO', 'WARNING', 'CRITICAL']);
  });

  it('rigorously scrubs sensitive secrets (passwords, tokens, private keys) from metadata', async () => {
    const rawMetadata = {
      email: 'test@sentinel.market',
      password: 'PlaintextPassword123!',
      user_password: 'AnotherSecretPassword',
      rawToken: 'jwt_or_reset_token_secret',
      privateKey: '0x123456789abcdef123456789abcdef',
      seedPhrase: 'twelve secret words for wallet recovery',
      safeConfig: {
        theme: 'dark',
        nestedSecret: {
          secretKey: 'nested_private_value',
        },
      },
    };

    const cleaned = auditService.sanitizeObject(rawMetadata);

    expect(cleaned.email).toBe('test@sentinel.market');
    expect(cleaned.password).toBe('[REDACTED]');
    expect(cleaned.user_password).toBe('[REDACTED]');
    expect(cleaned.rawToken).toBe('[REDACTED]');
    expect(cleaned.privateKey).toBe('[REDACTED]');
    expect(cleaned.seedPhrase).toBe('[REDACTED]');
    expect(cleaned.safeConfig.theme).toBe('dark');
    expect(cleaned.safeConfig.nestedSecret.secretKey).toBe('[REDACTED]');
  });
});
