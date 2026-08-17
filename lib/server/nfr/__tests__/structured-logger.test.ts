import { describe, it, expect, vi } from 'vitest';
import { StructuredLogger, sanitizeLogData } from '../structured-logger';

describe('Structured Logger & Secret Redaction', () => {
  it('formats structured log payloads with standard fields', () => {
    const logger = new StructuredLogger('test-service', 'DEBUG');
    const payload = logger.format('INFO', 'Order executed successfully', {
      requestId: 'req_123',
      userId: 'user_456',
      event: 'ORDER_CONFIRMED',
      latencyMs: 42,
      metadata: { symbol: '$SENT', amount: 100 },
    });

    expect(payload.service).toBe('test-service');
    expect(payload.level).toBe('INFO');
    expect(payload.message).toBe('Order executed successfully');
    expect(payload.requestId).toBe('req_123');
    expect(payload.userId).toBe('user_456');
    expect(payload.event).toBe('ORDER_CONFIRMED');
    expect(payload.latencyMs).toBe(42);
    expect(payload.metadata).toEqual({ symbol: '$SENT', amount: 100 });
  });

  it('redacts sensitive API keys and Bearer tokens', () => {
    const sensitiveMeta = {
      apiKey: 'mock_secret_api_key_1234567890',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.mock_signature',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret',
      },
      password: 'SuperSecretPassword123!',
      mnemonic: 'witch collapse practice feed shame open despair creek road again ice least',
      publicInfo: 'So11111111111111111111111111111111111111112',
    };

    const sanitized = sanitizeLogData(sensitiveMeta) as any;
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.mnemonic).toBe('[REDACTED]');
    expect(sanitized.headers.authorization).toContain('[REDACTED]');
    expect(sanitized.publicInfo).toBe('So11111111111111111111111111111111111111112');
  });

  it('filters out logs below minimum level in production mode', () => {
    const prodLogger = new StructuredLogger('prod-service', 'INFO');
    const debugResult = prodLogger.debug('This is noisy debug output');
    expect(debugResult).toBeNull();

    const infoResult = prodLogger.info('This is an important event');
    expect(infoResult).not.toBeNull();
    expect(infoResult?.level).toBe('INFO');
  });
});
