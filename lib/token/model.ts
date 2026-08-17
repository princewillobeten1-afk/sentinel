export interface TokenModel {
  id: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
