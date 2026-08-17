import { birdeye } from './client';

export interface TokenOverview {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  marketCap: number;
  fdv: number;
  totalSupply: number;
  circulatingSupply: number;
  extensions?: {
    coingeckoId?: string;
    serumV3Usdc?: string;
    serumV3Usdt?: string;
    website?: string;
    telegram?: string | null;
    twitter?: string;
    description?: string;
    discord?: string;
    medium?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  logoURI: string;
  liquidity: number;
  lastTradeUnixTime: number;
  lastTradeHumanTime: string;
  price: number;
  global_fees_paid?: number | null;
  holder?: number | null;
  numberMarkets: number;
  isScaledUiToken?: boolean;
  multiplier?: number | null;

  // We allow indexing because Birdeye returns dynamic timeframe fields 
  // like trade1m, trade5m, v30mUSD, priceChange24hPercent depending on requested frames
  [key: string]: any;
}

export interface TokenOverviewOptions {
  address: string;
  frames?: string; // e.g., '1m,5m,1h'
  ui_amount_mode?: 'raw' | 'scaled';
}

export async function getTokenOverview(options: TokenOverviewOptions | string): Promise<TokenOverview> {
  const queryParams = new URLSearchParams();
  
  if (typeof options === 'string') {
    queryParams.append('address', options);
  } else {
    queryParams.append('address', options.address);
    if (options.frames) queryParams.append('frames', options.frames);
    if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);
  }

  return birdeye.fetch<TokenOverview>(`/defi/token_overview?${queryParams.toString()}`);
}

export interface TokenMarketData {
  address: string;
  price: number;
  liquidity: number;
  total_supply: number;
  circulating_supply: number;
  market_cap: number;
  fdv: number;
  holder?: number | null;
  is_scaled_ui_token?: boolean | null;
  multiplier?: number | null;
}

export interface TokenMarketDataOptions {
  address: string;
  ui_amount_mode?: 'raw' | 'scaled';
}

export async function getTokenMarketData(options: string | TokenMarketDataOptions): Promise<TokenMarketData> {
  const queryParams = new URLSearchParams();
  if (typeof options === 'string') {
    queryParams.append('address', options);
  } else {
    queryParams.append('address', options.address);
    if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);
  }
  return birdeye.fetch<TokenMarketData>(`/defi/v3/token/market-data?${queryParams.toString()}`);
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  extensions?: {
    coingecko_id?: string;
    website?: string;
    twitter?: string;
    discord?: string;
    medium?: string;
    [key: string]: string | undefined;
  };
  logo_uri: string;
}

export async function getTokenMetadataSingle(address: string): Promise<TokenMetadata> {
  return birdeye.fetch<TokenMetadata>(`/defi/v3/token/meta-data/single?address=${address}`);
}

export async function getTokenMetadataMultiple(addresses: string[]): Promise<Record<string, TokenMetadata | null>> {
  if (addresses.length > 50) {
    throw new Error('Birdeye API allows a maximum of 50 addresses per metadata request.');
  }
  const listAddress = addresses.join(',');
  return birdeye.fetch<Record<string, TokenMetadata | null>>(`/defi/v3/token/meta-data/multiple?list_address=${listAddress}`);
}
