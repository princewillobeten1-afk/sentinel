import { birdeye } from './client';

export interface LatestBlockNumber {
  block_number: number;
}

export interface BlockchainAccountDetailResponseData {
  name?: string;
  program?: string;
  lamports?: number;
  data?: string;
  data_parsed?: Record<string, any>;
  owner?: string;
  executable?: boolean;
  rent_epoch?: number;
  is_on_curve?: boolean;
  decode_error?: string;
}

export type BlockchainAccountMultipleResponseData = Record<string, BlockchainAccountDetailResponseData>;

export interface BlockchainTokenAccount {
  token_account: string;
  mint: string;
  decimals: number;
  amount: number;
  state: 'uninitialized' | 'initialized' | 'frozen';
}

export interface BlockchainTokenAccountsParams {
  owner: string;
  state?: 'uninitialized' | 'initialized' | 'frozen';
  hide_zero?: boolean;
}

export interface BlockchainTokenMetadataCreator {
  address: string;
  verified: boolean;
  share: number;
}

export interface BlockchainTokenMetadataCollection {
  verified: boolean;
  key: string;
}

export interface BlockchainTokenMetadataResponseData {
  supply?: number;
  decimals?: number;
  is_initialized?: boolean;
  mint_authority?: string | null;
  freeze_authority?: string | null;
  is_nft?: boolean;
  key?: string;
  update_authority?: string | null;
  name?: string;
  symbol?: string;
  uri?: string;
  seller_fee_basis_points?: number;
  creators?: BlockchainTokenMetadataCreator[];
  primary_sale_happened?: boolean;
  is_mutable?: boolean;
  edition_nonce?: number | null;
  token_standard?: string;
  collection?: BlockchainTokenMetadataCollection;
}

export type BlockchainTokenMetadataMultipleResponseData = Record<string, BlockchainTokenMetadataResponseData | null>;

export interface BlockchainTransactionDetailSolBalanceChange {
  address?: string;
  pre_balance?: number;
  post_balance?: number;
}

export interface BlockchainTransactionDetailResponseData {
  signatures?: string[];
  signers?: string[];
  slot?: number;
  fee?: number;
  priority_fee?: number;
  cost_units?: number;
  compute_units_consumed?: number;
  sol_balance_changes?: BlockchainTransactionDetailSolBalanceChange[];
  token_balance_changes?: Record<string, any>[];
  instructions?: Record<string, any>[];
  inner_instructions?: Record<string, any>[];
  logs?: string[];
  block_time?: number;
  status?: Record<string, any>;
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
 * Retrieve the latest block number of trades on a chain
 * Note: Currently only supports Solana.
 */
export async function getLatestBlockNumber(chain: string = 'solana'): Promise<LatestBlockNumber> {
  const options: RequestInit = {
    headers: { 'x-chain': chain }
  };
  return birdeye.fetch<LatestBlockNumber>(`/defi/v3/txs/latest-block`, options);
}

/**
 * Retrieve a list of all supported networks.
 */
export async function getSupportedNetworks(): Promise<string[]> {
  return birdeye.fetch<string[]>(`/defi/networks`);
}

/**
 * Returns account details for a Solana address.
 */
export async function getBlockchainAccountDetail(address: string): Promise<BlockchainAccountDetailResponseData> {
  return birdeye.fetch<BlockchainAccountDetailResponseData>(`/blockchain/v1/account/detail?address=${address}`);
}

/**
 * Returns account details for up to 100 Solana addresses.
 */
export async function getBlockchainAccountMultiple(addresses: string[]): Promise<BlockchainAccountMultipleResponseData> {
  return birdeye.fetch<BlockchainAccountMultipleResponseData>('/blockchain/v1/account/detail/multiple', {
    method: 'POST',
    body: JSON.stringify({ addresses }),
  });
}

/**
 * Returns token accounts owned by a Solana address.
 */
export async function getBlockchainTokenAccounts(
  params: BlockchainTokenAccountsParams
): Promise<BlockchainTokenAccount[]> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<BlockchainTokenAccount[]>(`/blockchain/v1/account/token-accounts?${queryString}`);
}

/**
 * Returns metadata for a Solana token mint.
 */
export async function getBlockchainTokenMetadata(token: string): Promise<BlockchainTokenMetadataResponseData> {
  return birdeye.fetch<BlockchainTokenMetadataResponseData>(`/blockchain/v1/token/metadata?token=${token}`);
}

/**
 * Returns metadata for up to 100 Solana token mints.
 */
export async function getBlockchainTokenMetadataMultiple(tokens: string[]): Promise<BlockchainTokenMetadataMultipleResponseData> {
  return birdeye.fetch<BlockchainTokenMetadataMultipleResponseData>('/blockchain/v1/token/metadata/multiple', {
    method: 'POST',
    body: JSON.stringify({ tokens }),
  });
}

/**
 * Returns details for a Solana transaction signature.
 */
export async function getBlockchainTransactionDetail(signature: string): Promise<BlockchainTransactionDetailResponseData> {
  return birdeye.fetch<BlockchainTransactionDetailResponseData>(`/blockchain/v1/transaction/detail?signature=${signature}`);
}
