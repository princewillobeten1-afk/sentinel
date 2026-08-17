import type { SentinelClient } from '../client';

export interface ExitabilityReport {
  tokenId: string;
  symbol: string;
  chain: string;
  referencePositionUsd: number;
  score: number;
  interpretation: string;
  confidence: number;
  stressScore: number;
  expectedOutputUsd: number;
  minimumProceedsUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  route: unknown;
  liquidity: Record<string, unknown>;
  curve: unknown;
  exitDepth: unknown[];
  holderPressure: unknown;
  stress: Record<string, unknown>;
  warnings: unknown[];
  explanation: unknown;
  signals: unknown[];
  alertEvents: unknown[];
  isSimulation: true;
  timestamp: string;
}

/**
 * Exitability — "can I actually get out of this position, and at what cost"
 * (`app/api/v1/exitability/:chain/:token`). Requires `READ_TOKEN_INTELLIGENCE`;
 * works unauthenticated too (`optionalAuth`). Every score here is a
 * simulation, never a live quote — see `isSimulation` on the response.
 */
export class ExitabilityResource {
  constructor(private readonly client: SentinelClient) {}

  get(chain: string, token: string, params: { amount?: number } = {}): Promise<ExitabilityReport> {
    return this.client.get(`/api/v1/exitability/${chain}/${token}`, { query: params });
  }
}
