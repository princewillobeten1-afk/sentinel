import type { SentinelClient } from '../client';

/**
 * Creator — deployer identity, launch history and reputation
 * (`app/api/v1/creator/:chain/:address/**`). `address` accepts a wallet
 * address, a creator ID, or a known token symbol (the routes resolve all
 * three the same way the underlying mock/engine data does). Requires
 * `READ_REPUTATION`; works unauthenticated too (`optionalAuth`).
 */
export class CreatorResource {
  constructor(private readonly client: SentinelClient) {}

  get(chain: string, address: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/creator/${chain}/${address}`);
  }

  history(chain: string, address: string): Promise<{ creatorId: string; launches: unknown[]; count: number }> {
    return this.client.get(`/api/v1/creator/${chain}/${address}/history`);
  }

  relationships(chain: string, address: string): Promise<{ creatorId: string; associatedWallets: unknown[]; count: number }> {
    return this.client.get(`/api/v1/creator/${chain}/${address}/relationships`);
  }

  reputation(chain: string, address: string): Promise<{ creatorId: string; reputation: Record<string, unknown> }> {
    return this.client.get(`/api/v1/creator/${chain}/${address}/reputation`);
  }
}
