import { birdeye } from './client';

export interface CreditsUsageMetrics {
  api: number;
  ws: number;
  total: number;
}

export interface CreditsUsageData {
  start_time: number;
  end_time: number;
  usage: CreditsUsageMetrics;
  remaining: CreditsUsageMetrics;
  overage_usage: CreditsUsageMetrics;
  overage_cost: CreditsUsageMetrics;
}

export interface CreditsUsageParams {
  time_from?: number; // Unix timestamp in seconds
  time_to?: number;   // Unix timestamp in seconds
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  }
  return query.toString();
}

export async function getCreditsUsage(params: CreditsUsageParams = {}): Promise<CreditsUsageData> {
  const queryString = buildQueryString(params);
  const endpoint = `/utils/v1/credits${queryString ? `?${queryString}` : ''}`;
  return birdeye.fetch<CreditsUsageData>(endpoint);
}
