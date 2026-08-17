/** Mirrors the envelope shape returned by every Sentinel API error response (`lib/server/api.ts#errorResponse`). */
export class SentinelApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, details: unknown, requestId: string | null) {
    super(message);
    this.name = 'SentinelApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

/** Thrown for network failures, timeouts, or a response that isn't valid JSON — distinct from a well-formed API error. */
export class SentinelNetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SentinelNetworkError';
  }
}
