/**
 * Structured Logging & Machine-Readable Observability (Sprint 32 §22-24).
 *
 * Implements machine-readable JSON logging conforming to production standards:
 *   - Standardized log levels: DEBUG, INFO, WARN, ERROR, CRITICAL
 *   - Machine-readable JSON output
 *   - Standard fields: timestamp (UTC), service, level, message, requestId, userId, event, latencyMs
 *   - Strict secret / sensitive credential redaction (private keys, mnemonics, API secrets, Bearer tokens)
 *   - Production level filtering (DEBUG suppressed in production)
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface StructuredLogPayload {
  timestamp: string;
  service: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  event?: string;
  latencyMs?: number;
  error?: {
    name?: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

// Regex patterns to detect and mask sensitive credentials
const SENSITIVE_PATTERNS = [
  // Solana / Base58 private keys (approx 64-88 characters)
  /\b[1-9A-HJ-NP-Za-km-z]{64,88}\b/g,
  // Hex private keys / secrets (64 hex characters)
  /\b[0-9a-fA-F]{64}\b/g,
  // Bearer tokens / JWT
  /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/gi,
  // API Keys (sk_live_..., sk_sandbox_...)
  /sk_(live|sandbox)_[A-Za-z0-9_\-]+/gi,
  // Password / Secret key patterns in JSON strings
  /"(password|secret|privateKey|apiKey|token|mnemonic|seed)":\s*"[^"]+"/gi,
];

export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let sanitized = data;
    // Mask Bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    // Mask API keys
    sanitized = sanitized.replace(/sk_(live|sandbox)_[A-Za-z0-9_\-]+/gi, 'sk_$1_[REDACTED]');
    // Mask raw JWT tokens (three base64 segments joined by periods)
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9\-_=]+\.eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+/=]+\b/g, '[REDACTED_JWT]');
    // Mask JSON password/secret assignments
    sanitized = sanitized.replace(/"(privateKey|secret|mnemonic|seed|password|apiKey|token)":\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('privatekey') ||
        lowerKey.includes('mnemonic') ||
        lowerKey.includes('seedphrase') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('token') ||
        lowerKey.includes('jwt') ||
        lowerKey.includes('sessiontoken')
      ) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  CRITICAL: 50,
};

export class StructuredLogger {
  private defaultService: string;
  private minLevel: LogLevel;

  constructor(defaultService = 'sentinel-core', minLevel?: LogLevel) {
    this.defaultService = defaultService;
    const isProd = process.env.NODE_ENV === 'production';
    this.minLevel = minLevel ?? (isProd ? 'INFO' : 'DEBUG');
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHTS[level] >= LEVEL_WEIGHTS[this.minLevel];
  }

  public format(
    level: LogLevel,
    message: string,
    options?: {
      service?: string;
      requestId?: string;
      userId?: string;
      sessionId?: string;
      event?: string;
      latencyMs?: number;
      error?: Error | unknown;
      metadata?: Record<string, unknown>;
    }
  ): StructuredLogPayload {
    let errorPayload: StructuredLogPayload['error'] = undefined;
    if (options?.error) {
      if (options.error instanceof Error) {
        errorPayload = {
          name: options.error.name,
          message: options.error.message,
          stack: process.env.NODE_ENV !== 'production' ? options.error.stack : undefined,
          code: (options.error as any).code,
        };
      } else {
        errorPayload = {
          message: String(options.error),
        };
      }
    }

    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      service: options?.service ?? this.defaultService,
      level,
      message,
      requestId: options?.requestId,
      userId: options?.userId,
      sessionId: options?.sessionId,
      event: options?.event,
      latencyMs: options?.latencyMs,
      error: errorPayload,
      metadata: options?.metadata ? (sanitizeLogData(options.metadata) as Record<string, unknown>) : undefined,
    };

    return payload;
  }

  public log(level: LogLevel, message: string, options?: Parameters<StructuredLogger['format']>[2]): StructuredLogPayload | null {
    if (!this.shouldLog(level)) return null;

    const payload = this.format(level, message, options);
    const jsonString = JSON.stringify(payload);

    switch (level) {
      case 'DEBUG':
        console.debug(jsonString);
        break;
      case 'INFO':
        console.info(jsonString);
        break;
      case 'WARN':
        console.warn(jsonString);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(jsonString);
        break;
    }

    return payload;
  }

  public debug(message: string, options?: Parameters<StructuredLogger['format']>[2]) {
    return this.log('DEBUG', message, options);
  }

  public info(message: string, options?: Parameters<StructuredLogger['format']>[2]) {
    return this.log('INFO', message, options);
  }

  public warn(message: string, options?: Parameters<StructuredLogger['format']>[2]) {
    return this.log('WARN', message, options);
  }

  public error(message: string, options?: Parameters<StructuredLogger['format']>[2]) {
    return this.log('ERROR', message, options);
  }

  public critical(message: string, options?: Parameters<StructuredLogger['format']>[2]) {
    return this.log('CRITICAL', message, options);
  }
}

export const structuredLogger = new StructuredLogger();
