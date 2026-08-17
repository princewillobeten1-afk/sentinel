import { birdeye } from './client';

export type IdentityType = 'wallet' | 'exchange' | 'protocol' | 'token' | 'program' | 'unknown';

export interface IdentitySingleResponseData {
  address: string;
  input_domain?: string;
  type: IdentityType;
  entity?: string;
  label?: string;
  category?: string;
  tags?: string[];
  domains?: string[];
  domains_total?: number;
}

export type IdentityMultipleResponseData = Record<string, IdentitySingleResponseData>;

export interface IdentityDomainsResponseData {
  address: string;
  total: number;
  offset: number;
  limit: number;
  domains: string[];
}

export interface IdentityDomainsParams {
  offset?: number;
  limit?: number;
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

/**
 * Resolve one address to a compact identity.
 */
export async function getIdentitySingle(address: string): Promise<IdentitySingleResponseData> {
  return birdeye.fetch<IdentitySingleResponseData>(`/identity/v1/single?address=${address}`);
}

/**
 * Resolve up to 100 addresses to their identities in one request.
 */
export async function getIdentityMultiple(addresses: string[]): Promise<IdentityMultipleResponseData> {
  return birdeye.fetch<IdentityMultipleResponseData>('/identity/v1/multiple', {
    method: 'POST',
    body: JSON.stringify({ addresses }),
  });
}

/**
 * The full, paginated .sol domain list for one wallet.
 */
export async function getIdentityDomains(
  address: string,
  params: IdentityDomainsParams = {}
): Promise<IdentityDomainsResponseData> {
  const queryString = buildQueryString({ address, ...params });
  return birdeye.fetch<IdentityDomainsResponseData>(`/identity/v1/domains?${queryString}`);
}
