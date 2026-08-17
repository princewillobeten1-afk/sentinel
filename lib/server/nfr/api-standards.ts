/**
 * API Standards, Deprecation & RFC Error Formatting (Sprint 32 §18-21).
 *
 * Implements API conventions across Sentinel:
 *   - Explicit API Versioning (/v1, /v2)
 *   - RFC 8594 Deprecation & Sunset Response Headers
 *   - RFC 7807 Problem Details for HTTP APIs with Actionable Recovery Guidance
 */

import { ApiError } from '../errors';

export interface DeprecationPolicy {
  isDeprecated: boolean;
  deprecatedSince?: string; // ISO date
  sunsetDate?: string; // ISO date or HTTP-date
  replacementUrl?: string;
  migrationGuideUrl?: string;
}

export interface ProblemDetails {
  type: string; // URI reference
  title: string;
  status: number;
  detail: string;
  instance?: string; // request URI or ID
  code: string;
  recoveryAction?: {
    action: 'RETRY' | 'RECONNECT' | 'REFRESH' | 'REVIEW_TRANSACTION' | 'INCREASE_SLIPPAGE' | 'CONTACT_SUPPORT';
    label: string;
    description: string;
  };
  details?: unknown;
}

/**
 * Builds RFC 8594 Deprecation headers if an endpoint is deprecated.
 */
export function getDeprecationHeaders(policy?: DeprecationPolicy): Record<string, string> {
  if (!policy || !policy.isDeprecated) {
    return {};
  }

  const headers: Record<string, string> = {
    Deprecation: policy.deprecatedSince ? `@${Math.floor(new Date(policy.deprecatedSince).getTime() / 1000)}` : 'true',
  };

  if (policy.sunsetDate) {
    headers['Sunset'] = new Date(policy.sunsetDate).toUTCString();
  }

  if (policy.migrationGuideUrl) {
    headers['Link'] = `<${policy.migrationGuideUrl}>; rel="deprecation"; type="text/html"`;
  }

  return headers;
}

/**
 * Resolves appropriate recovery action for standard Sentinel error codes.
 */
export function resolveRecoveryAction(code: string): ProblemDetails['recoveryAction'] {
  switch (code) {
    case 'DEPENDENCY_TIMEOUT':
    case 'RATE_LIMITED':
      return {
        action: 'RETRY',
        label: 'Retry Request',
        description: 'Network or dependency temporarily busy. Retry in a few seconds.',
      };
    case 'SLIPPAGE_EXCEEDED':
    case 'PRICE_IMPACT_TOO_HIGH':
      return {
        action: 'INCREASE_SLIPPAGE',
        label: 'Adjust Slippage',
        description: 'Market moved rapidly during swap routing. Increase your slippage tolerance.',
      };
    case 'CIRCUIT_BREAKER_OPEN':
    case 'DEGRADED_MODE':
      return {
        action: 'REFRESH',
        label: 'Refresh Subsystem',
        description: 'Subsystem is currently recovering. Try refreshing or viewing basic markets.',
      };
    case 'UNAUTHORIZED':
    case 'SESSION_EXPIRED':
    case 'AUTH_REQUIRED':
      return {
        action: 'RECONNECT',
        label: 'Reconnect Wallet',
        description: 'Your session has expired. Re-authenticate with your Solana wallet.',
      };
    default:
      return {
        action: 'REVIEW_TRANSACTION',
        label: 'Review Details',
        description: 'Review the transaction parameters and try again.',
      };
  }
}

/**
 * Formats an error into RFC 7807 Problem Details JSON format.
 */
export function createProblemDetailsResponse(
  error: Error | ApiError,
  requestUrl?: string,
  requestId?: string,
  deprecationPolicy?: DeprecationPolicy
): Response {
  const isApiErr = error instanceof ApiError;
  const status = isApiErr ? error.statusCode : 500;
  const code = isApiErr ? error.code : 'INTERNAL_SERVER_ERROR';
  const detail = error.message || 'An unexpected error occurred.';
  const recoveryAction = resolveRecoveryAction(code);

  const problem: ProblemDetails = {
    type: `https://sentinel.trade/errors/${code.toLowerCase()}`,
    title: isApiErr ? error.name || 'API Error' : 'Internal Server Error',
    status,
    detail,
    instance: requestId ? `urn:sentinel:request:${requestId}` : requestUrl,
    code,
    recoveryAction,
    details: isApiErr ? error.details : undefined,
  };

  const deprecationHeaders = getDeprecationHeaders(deprecationPolicy);

  return new Response(JSON.stringify({ success: false, error: problem }), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      ...deprecationHeaders,
      ...(requestId ? { 'X-Request-Id': requestId } : {}),
    },
  });
}
