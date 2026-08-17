import type { SentinelClient } from '../client';

/**
 * Ownership — holder concentration, clusters and wallet-relationship graphs
 * (`app/api/v1/ownership/**`). Requires `READ_REPUTATION`; works
 * unauthenticated too (`optionalAuth`).
 */
export class OwnershipResource {
  constructor(private readonly client: SentinelClient) {}

  get(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/ownership/${chain}/${token}`);
  }

  clusters(chain: string, token: string): Promise<{ clusters: unknown[]; count: number }> {
    return this.client.get(`/api/v1/ownership/${chain}/${token}/clusters`);
  }

  timeline(chain: string, token: string): Promise<{ timeline: unknown[]; count: number }> {
    return this.client.get(`/api/v1/ownership/${chain}/${token}/timeline`);
  }

  wallet(address: string): Promise<{ address: string; relationships: unknown[]; count: number }> {
    return this.client.get(`/api/v1/ownership/wallet/${address}`);
  }
}
