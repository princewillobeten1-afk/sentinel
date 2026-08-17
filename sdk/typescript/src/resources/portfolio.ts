import type { SentinelClient } from '../client';

export interface PositionsQuery {
  sort?: 'VALUE' | 'PNL' | 'RISK' | 'ALLOCATION' | 'EXITABILITY';
  direction?: 'asc' | 'desc';
  status?: 'OPEN' | 'CLOSED' | 'DUST';
  [key: string]: string | number | boolean | undefined;
}

/**
 * Portfolio — cost basis, P&L, risk and exposure for a wallet
 * (`app/api/v1/portfolio/:wallet/**`). Requires `READ_PORTFOLIO` and either a
 * session or an API key belonging to the wallet's owner — every method 403s
 * with `WALLET_NOT_AUTHORIZED` for a wallet the caller doesn't own
 * (`lib/portfolio/wallet-groups.ts#isWalletAuthorized`), so there is no
 * `optionalAuth` here, unlike the read-only intelligence/discovery resources.
 */
export class PortfolioResource {
  constructor(private readonly client: SentinelClient) {}

  get(wallet: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/portfolio/${wallet}`);
  }

  positions(wallet: string, query: PositionsQuery = {}): Promise<{ positions: unknown[]; count: number; sort: string; direction: string }> {
    return this.client.get(`/api/v1/portfolio/${wallet}/positions`, { query });
  }

  pnl(wallet: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/portfolio/${wallet}/pnl`);
  }

  risk(wallet: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/portfolio/${wallet}/risk`);
  }

  exposure(wallet: string): Promise<{ exposure: Record<string, unknown> }> {
    return this.client.get(`/api/v1/portfolio/${wallet}/exposure`);
  }

  performance(wallet: string): Promise<{ performance: Record<string, unknown> }> {
    return this.client.get(`/api/v1/portfolio/${wallet}/performance`);
  }
}
