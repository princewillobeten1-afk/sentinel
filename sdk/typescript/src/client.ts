import { SentinelApiError, SentinelNetworkError } from './errors';
import { IntelligenceResource } from './resources/intelligence';
import { ExitabilityResource } from './resources/exitability';
import { OwnershipResource } from './resources/ownership';
import { CreatorResource } from './resources/creator';
import { DiscoveryResource } from './resources/discovery';
import { PortfolioResource } from './resources/portfolio';
import { ExecutionResource } from './resources/execution';
import { LaunchesResource } from './resources/launches';
import { WebhooksResource } from './resources/webhooks';

export interface SentinelClientOptions {
  /** `sk_live_...` or `sk_sandbox_...` — see `lib/server/api-keys.ts`. */
  apiKey: string;
  /** Defaults to the production API. Point at `http://localhost:3000` (or your `PORT`) for local development. */
  baseUrl?: string;
  /** Injectable for tests / non-global-fetch runtimes. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /** Query string params, appended as `?key=value`. `undefined`/`null` values are omitted. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Sent as the `Idempotency-Key` header — see `lib/server/idempotency.ts`. Required for a safe retry of a write. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

/** Metadata from the most recently completed request — rate-limit headroom and the request ID for support/debugging. */
export interface LastResponseMeta {
  requestId: string | null;
  rateLimit: RateLimitInfo;
  status: number;
}

const DEFAULT_BASE_URL = 'https://api.sentinel.dev';

export class SentinelClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private lastMeta: LastResponseMeta | null = null;

  readonly intelligence: IntelligenceResource;
  readonly exitability: ExitabilityResource;
  readonly ownership: OwnershipResource;
  readonly creator: CreatorResource;
  readonly discovery: DiscoveryResource;
  readonly portfolio: PortfolioResource;
  readonly execution: ExecutionResource;
  readonly launches: LaunchesResource;
  readonly webhooks: WebhooksResource;

  constructor(options: SentinelClientOptions) {
    if (!options.apiKey) throw new Error('SentinelClient requires an apiKey (sk_live_... or sk_sandbox_...)');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error('No fetch implementation available — pass { fetch } explicitly on this runtime.');
    }
    this.fetchImpl = fetchImpl;

    this.intelligence = new IntelligenceResource(this);
    this.exitability = new ExitabilityResource(this);
    this.ownership = new OwnershipResource(this);
    this.creator = new CreatorResource(this);
    this.discovery = new DiscoveryResource(this);
    this.portfolio = new PortfolioResource(this);
    this.execution = new ExecutionResource(this);
    this.launches = new LaunchesResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  /** Rate-limit headroom and request ID from the most recently completed call, for logging/backoff decisions. */
  get lastResponseMeta(): LastResponseMeta | null {
    return this.lastMeta;
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(method: string, path: string, body: unknown, options: RequestOptions): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: options.signal,
      });
    } catch (err) {
      throw new SentinelNetworkError(`Request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`, err);
    }

    this.lastMeta = {
      requestId: response.headers.get('x-request-id'),
      rateLimit: {
        limit: parseHeaderInt(response.headers.get('x-ratelimit-limit')),
        remaining: parseHeaderInt(response.headers.get('x-ratelimit-remaining')),
        reset: parseHeaderInt(response.headers.get('x-ratelimit-reset')),
      },
      status: response.status,
    };

    let payload: { success: boolean; data?: T; error?: { message: string; code: string; details?: unknown } };
    try {
      payload = await response.json();
    } catch (err) {
      throw new SentinelNetworkError(`Response from ${path} was not valid JSON (status ${response.status})`, err);
    }

    if (!payload.success) {
      const error = payload.error ?? { message: 'Unknown API error', code: 'UNKNOWN_ERROR' };
      throw new SentinelApiError(response.status, error.code, error.message, error.details, this.lastMeta.requestId);
    }

    return payload.data as T;
  }
}

function parseHeaderInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
