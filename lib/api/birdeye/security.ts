import { birdeye } from './client';

export interface SolanaTokenSecurityData {
  creatorAddress?: string;
  creatorBalance?: number | string | null;
  creatorPercentage?: number | string | null;
  ownerAddress?: string | null;
  ownerBalance?: number | string | null;
  ownerPercentage?: number | string | null;
  totalSupply?: number | string | null;
  
  creatorOwnerAddress?: string | null;
  ownerOfOwnerAddress?: string | null;
  creationTx?: string | null;
  creationTime?: number | null;
  creationSlot?: number | null;
  mintTx?: string | null;
  mintTime?: number | null;
  mintSlot?: number | null;
  
  metaplexUpdateAuthority?: string | null;
  metaplexOwnerUpdateAuthority?: string | null;
  metaplexUpdateAuthorityBalance?: number | null;
  metaplexUpdateAuthorityPercent?: number | null;
  mutableMetadata?: boolean | null;
  
  top10HolderBalance?: number | null;
  top10HolderPercent?: number | null;
  top10UserBalance?: number | null;
  top10UserPercent?: number | null;
  
  isTrueToken?: boolean | null;
  fakeToken?: boolean | null;
  preMarketHolder?: any[];
  lockInfo?: any | null;
  
  freezeable?: boolean | null;
  freezeAuthority?: string | null;
  transferFeeEnable?: boolean | null;
  transferFeeData?: any | null;
  isToken2022?: boolean | null;
  nonTransferable?: boolean | null;
  jupStrictList?: boolean | null;
}

export interface EvmTokenSecurityData {
  antiWhaleModifiable?: string | null;
  buyTax?: string | null;
  canTakeBackOwnership?: string | null;
  cannotBuy?: string | null;
  cannotSellAll?: string | null;
  externalCall?: string | null;
  hiddenOwner?: string | null;
  holderCount?: string | null;
  honeypotWithSameCreator?: string | null;
  
  isAntiWhale?: string | null;
  isBlacklisted?: string | null;
  isHoneypot?: string | null;
  isInDex?: string | null;
  isMintable?: string | null;
  isOpenSource?: string | null;
  isProxy?: string | null;
  isWhitelisted?: string | null;
  
  lpHolderCount?: string | null;
  lpHolders?: any[];
  lpTotalSupply?: string | null;
  
  ownerChangeBalance?: string | null;
  personalSlippageModifiable?: string | null;
  sellTax?: string | null;
  slippageModifiable?: string | null;
  
  tokenName?: string | null;
  tokenSymbol?: string | null;
  tradingCooldown?: string | null;
  transferPausable?: string | null;
}

// Combine both so consumers can access fields conditionally without strict type guards.
export interface TokenSecurityData extends SolanaTokenSecurityData, EvmTokenSecurityData {}

export async function getTokenSecurity(
  address: string,
  chain: string = 'solana'
): Promise<TokenSecurityData> {
  return birdeye.fetch<TokenSecurityData>(
    `/defi/token_security?address=${address}`,
    { headers: { 'x-chain': chain } }
  );
}
