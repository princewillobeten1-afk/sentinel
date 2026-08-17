/**
 * Sentinel API Client Abstraction Layer
 * Provides strongly-typed HTTP methods (GET, POST, PATCH, DELETE),
 * AbortSignal request cancellation, auth bearer token hooks, and error normalization.
 *
 * All paths are relative and automatically prefixed with /api.
 * Example: apiClient.get('/v1/tokens/trending') → fetch('/api/v1/tokens/trending')
 */

/** Base path prefix for all API calls. Uses relative path for same-origin. */
const API_PREFIX = '/api';

export interface ApiResponse<T> {
  data: T;
  status: number;
  error?: string | null;
  timestamp: string;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  authToken?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { body, authToken, signal, headers, method = 'GET', ...restInit } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: requestHeaders,
      signal,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      ...restInit,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: payload as T,
        status: response.status,
        error: payload?.message ?? payload?.error ?? response.statusText ?? 'API Error',
        timestamp,
      };
    }

    return {
      data: payload as T,
      status: response.status,
      error: null,
      timestamp,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        data: null as unknown as T,
        status: 499,
        error: 'Request cancelled by client',
        timestamp,
      };
    }

    return {
      data: null as unknown as T,
      status: 500,
      error: err instanceof Error ? err.message : 'Network failure',
      timestamp,
    };
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

