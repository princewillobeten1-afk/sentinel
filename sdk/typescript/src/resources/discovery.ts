import type { SentinelClient } from '../client';

/** Filter/pagination params shared by every discovery list endpoint — passed through as-is to the query string. */
export interface DiscoveryQuery {
  chain?: string;
  timeWindow?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface DiscoveryTokenList {
  section: string;
  chain: string;
  timeWindow: string;
  totalCount: number;
  limit: number;
  offset: number;
  tokens: unknown[];
  [key: string]: unknown;
}

export interface DiscoveryScreenBody {
  chain?: string;
  timeWindow?: string;
  sort?: 'trending' | 'volume' | 'liquidity' | 'age' | 'price_change' | 'market_cap' | 'score';
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

/**
 * Discovery — ranked token feeds by category (`app/api/v1/discovery/**`).
 * Requires `READ_MARKET_DATA`; every list method works unauthenticated too
 * (`optionalAuth`), matching the public discovery feed. `watchlist()` is the
 * one exception — it's personalized to the caller, so it requires a real
 * session or API key (`allowSessionAuth`, no `optionalAuth`).
 */
export class DiscoveryResource {
  constructor(private readonly client: SentinelClient) {}

  list(query: DiscoveryQuery = {}): Promise<Record<string, unknown>> {
    return this.client.get('/api/v1/discovery', { query });
  }

  trending(query: DiscoveryQuery = {}): Promise<DiscoveryTokenList> {
    return this.client.get('/api/v1/discovery/trending', { query });
  }

  momentum(query: DiscoveryQuery = {}): Promise<DiscoveryTokenList> {
    return this.client.get('/api/v1/discovery/momentum', { query });
  }

  volume(query: DiscoveryQuery = {}): Promise<DiscoveryTokenList> {
    return this.client.get('/api/v1/discovery/volume', { query });
  }

  liquidity(query: DiscoveryQuery = {}): Promise<DiscoveryTokenList> {
    return this.client.get('/api/v1/discovery/liquidity', { query });
  }

  movers(query: DiscoveryQuery = {}): Promise<Record<string, unknown>> {
    return this.client.get('/api/v1/discovery/movers', { query });
  }

  new(query: DiscoveryQuery = {}): Promise<DiscoveryTokenList> {
    return this.client.get('/api/v1/discovery/new', { query });
  }

  tokenSignals(token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/discovery/${token}/signals`);
  }

  screen(body: DiscoveryScreenBody): Promise<Record<string, unknown>> {
    return this.client.post('/api/v1/discovery/screen', body);
  }

  /** Personalized to the authenticated caller — requires a session or API key. */
  watchlist(query: DiscoveryQuery = {}): Promise<Record<string, unknown>> {
    return this.client.get('/api/v1/discovery/watchlist', { query });
  }
}
