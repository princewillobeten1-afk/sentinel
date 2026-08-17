import { birdeye } from './client';

// Helper to build query strings
function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => query.append(key, String(v)));
      } else {
        query.append(key, String(value));
      }
    }
  }
  return query.toString();
}

// ----------------------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------------------

export interface WalletBalanceChangeItem {
  time: string;
  block_number: number | string;
  block_unix_time: number;
  address: string;
  token_account: string;
  tx_hash: string;
  pre_balance: number | string;
  post_balance: number | string;
  amount: number | string;
  token_info?: any;
  type: string;
  type_text: string;
  change_type: string;
  change_type_text: string;
}

export interface WalletBalanceChangeResponse {
  items: WalletBalanceChangeItem[];
}

export interface WalletTokenHolding {
  address?: string;
  decimals?: number;
  balance?: number | string;
  uiAmount?: number;
  chainId?: string;
  network?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  logoURI?: string;
  logo_uri?: string;
  priceUsd?: number;
  price?: number;
  valueUsd?: number;
  value?: number | string;
  amount?: number;
  isScaledUiToken?: boolean;
  multiplier?: number | null;
}

// Legacy alias
export type TokenBalance = WalletTokenHolding;

export interface TransferEvent {
  time: string;
  block_number: number;
  unix_time: number;
  token_address: string;
  from_address: string;
  to_address: string;
  from_token_account?: string;
  to_token_account?: string;
  amount: number | string;
  ui_amount: number;
  price: number;
  value: number;
  tx_hash: string;
  flow?: string;
  token_info?: any;
  action: string;
}

// Legacy alias
export interface TokenTransfer {
  txHash?: string;
  blockTime?: number;
  from?: string;
  to?: string;
  amount?: number;
  uiAmount?: number;
  // Included standard TransferEvent fields
  time?: string;
  block_number?: number;
  unix_time?: number;
  token_address?: string;
  from_address?: string;
  to_address?: string;
  ui_amount?: number;
  price?: number;
  value?: number;
  tx_hash?: string;
}

// ----------------------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------------------

// Wallet - Token Balance (Beta)
export async function getWalletTokenBalance(
  wallet: string,
  token_address: string,
  params: {
    ui_amount_mode?: 'raw' | 'scaled';
    chain?: string;
  } = {}
): Promise<WalletTokenHolding> {
  const { chain, ...restParams } = params;
  const queryString = buildQueryString({ wallet, token_address, ...restParams });
  
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  } else {
    options.headers = { 'x-chain': 'solana' }; // default per docs
  }
  
  return birdeye.fetch<WalletTokenHolding>(`/v1/wallet/token_balance?${queryString}`, options);
}

// Wallet - Tokens Balance (V2)
export async function getWalletTokensBalanceV2(
  wallet: string,
  token_addresses: string[],
  chain: string = 'solana'
): Promise<WalletTokenHolding[]> {
  const options: RequestInit = {
    method: 'POST',
    headers: { 'x-chain': chain },
    body: JSON.stringify({ wallet, token_addresses })
  };
  return birdeye.fetch<WalletTokenHolding[]>(`/wallet/v2/token-balance`, options);
}

// Legacy alias for previous endpoint
export async function getWalletTokensBalance(walletAddress: string, tokenAddresses: string[]): Promise<WalletTokenHolding[]> {
  return getWalletTokensBalanceV2(walletAddress, tokenAddresses);
}

// Wallet - Balance Change
export async function getWalletBalanceChange(
  wallet: string,
  params: {
    token_address?: string;
    time_from?: number;
    time_to?: number;
    type?: 'SOL' | 'SPL';
    change_type?: 'increase' | 'decrease';
    offset?: number;
    limit?: number;
    ui_amount_mode?: 'raw' | 'scaled';
    chain?: string;
  } = {}
): Promise<WalletBalanceChangeResponse> {
  const { chain, ...restParams } = params;
  const queryString = buildQueryString({ address: wallet, ...restParams });
  
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  } else {
    options.headers = { 'x-chain': 'solana' }; // default per docs
  }
  
  return birdeye.fetch<WalletBalanceChangeResponse>(`/wallet/v2/balance-change?${queryString}`, options);
}

// Token - Transfer List
export async function getTokenTransferList(
  token_address: string,
  params: {
    time_from?: number;
    time_to?: number;
    from_amount?: number;
    to_amount?: number;
    from_value?: number;
    to_value?: number;
    from_wallet?: string;
    to_wallet?: string;
    cursor?: string;
    limit?: number;
    chain?: string;
  } = {}
): Promise<TransferEvent[]> {
  const { chain, ...bodyParams } = params;
  const body = { token_address, ...bodyParams };
  
  const options: RequestInit = {
    method: 'POST',
    headers: { 'x-chain': chain || 'solana' },
    body: JSON.stringify(body)
  };
  
  return birdeye.fetch<TransferEvent[]>(`/token/v1/transfer`, options);
}

// Legacy alias for previous endpoint
export async function getTokenTransfers(tokenAddress: string, offset: number = 0, limit: number = 50): Promise<TransferEvent[]> {
  // Using the new v1 transfer endpoint which uses cursor, not offset, but we map roughly to preserve signature
  return getTokenTransferList(tokenAddress, { limit });
}

// Token - Transfer Total
export async function getTokenTransferTotal(
  token_address: string,
  params: {
    time_from?: number;
    time_to?: number;
    from_amount?: number;
    to_amount?: number;
    from_value?: number;
    to_value?: number;
    from_wallet?: string;
    to_wallet?: string;
    chain?: string;
  } = {}
): Promise<{ total: number }> {
  const { chain, ...bodyParams } = params;
  const body = { token_address, ...bodyParams };
  
  const options: RequestInit = {
    method: 'POST',
    headers: { 'x-chain': chain || 'solana' },
    body: JSON.stringify(body)
  };
  
  return birdeye.fetch<{ total: number }>(`/token/v1/transfer/total`, options);
}

// Wallet - Transfer List
export async function getWalletTransferList(
  wallet: string,
  params: {
    token_address?: string;
    flow?: 'in' | 'out';
    time_from?: number;
    time_to?: number;
    from_amount?: number;
    to_amount?: number;
    from_value?: number;
    to_value?: number;
    from_wallet?: string;
    to_wallet?: string;
    cursor?: string;
    limit?: number;
    chain?: string;
  } = {}
): Promise<TransferEvent[]> {
  const { chain, ...bodyParams } = params;
  const body = { wallet, ...bodyParams };
  
  const options: RequestInit = {
    method: 'POST',
    headers: { 'x-chain': chain || 'solana' },
    body: JSON.stringify(body)
  };
  
  return birdeye.fetch<TransferEvent[]>(`/wallet/v2/transfer`, options);
}

// Wallet - Transfer Total
export async function getWalletTransferTotal(
  wallet: string,
  params: {
    token_address?: string;
    flow?: 'in' | 'out';
    time_from?: number;
    time_to?: number;
    from_amount?: number;
    to_amount?: number;
    from_value?: number;
    to_value?: number;
    from_wallet?: string;
    to_wallet?: string;
    chain?: string;
  } = {}
): Promise<{ total: number }> {
  const { chain, ...bodyParams } = params;
  const body = { wallet, ...bodyParams };
  
  const options: RequestInit = {
    method: 'POST',
    headers: { 'x-chain': chain || 'solana' },
    body: JSON.stringify(body)
  };
  
  return birdeye.fetch<{ total: number }>(`/wallet/v2/transfer/total`, options);
}
