import type { SentinelClient } from '../client';

export interface TokenIntelligenceReport {
  token: Record<string, unknown>;
  overallScore: number;
  riskLevel: string;
  confidence: number;
  riskDimensions: Record<string, unknown>;
  signals: unknown[];
  warnings: unknown[];
  positives: unknown[];
  [key: string]: unknown;
}

/**
 * Token Intelligence — risk scoring across contract, liquidity, market and
 * on-chain-activity dimensions (`app/api/v1/intelligence/:chain/:token/**`).
 * Requires `READ_TOKEN_INTELLIGENCE`; every method also works unauthenticated
 * (`optionalAuth`), matching the public web app's own usage.
 */
export class IntelligenceResource {
  constructor(private readonly client: SentinelClient) {}

  get(chain: string, token: string): Promise<TokenIntelligenceReport> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}`);
  }

  activity(chain: string, token: string, params: { window?: string } = {}): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/activity`, { query: params });
  }

  contract(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/contract`);
  }

  history(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/history`);
  }

  insiders(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/insiders`);
  }

  liquidity(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/liquidity`);
  }

  market(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/market`);
  }

  organic(chain: string, token: string, params: { window?: string } = {}): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/organic`, { query: params });
  }

  signals(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/signals`);
  }

  timeline(chain: string, token: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/intelligence/${chain}/${token}/timeline`);
  }
}
