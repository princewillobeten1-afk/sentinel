import type { SentinelClient } from '../client';

export interface LaunchConfigInput {
  [key: string]: unknown;
}

export interface AnalyzeLaunchResult {
  risk: Record<string, unknown>;
}

export interface DeployLaunchResult {
  deployment: Record<string, unknown>;
  risk: Record<string, unknown>;
}

/**
 * Launches — bonding-curve launch analysis, deployment and simulation
 * (`app/api/v1/launches/**`). `analyze`/`deploy` require the dangerous
 * `CREATE_LAUNCH` scope (never auto-granted); reads are `optionalAuth`.
 */
export class LaunchesResource {
  constructor(private readonly client: SentinelClient) {}

  list(): Promise<{ launches: unknown[] }> {
    return this.client.get('/api/v1/launches');
  }

  get(id: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/launches/${id}`);
  }

  intelligence(id: string): Promise<Record<string, unknown>> {
    return this.client.get(`/api/v1/launches/${id}/intelligence`);
  }

  simulate(id: string, action: 'BUY' | 'SELL', amount: number, state: unknown): Promise<Record<string, unknown>> {
    return this.client.post(`/api/v1/launches/${id}/simulate`, { action, amount, state });
  }

  /** Preflight risk analysis only — does not deploy anything. */
  analyze(config: LaunchConfigInput, creatorWallet?: string): Promise<AnalyzeLaunchResult> {
    return this.client.post('/api/v1/launches', { action: 'ANALYZE', config, creatorWallet });
  }

  /** Actually deploys the launch. Rejected server-side if preflight risk is CRITICAL. */
  deploy(config: LaunchConfigInput, creatorWallet?: string, idempotencyKey?: string): Promise<DeployLaunchResult> {
    return this.client.post('/api/v1/launches', { action: 'DEPLOY', config, creatorWallet }, { idempotencyKey });
  }
}
