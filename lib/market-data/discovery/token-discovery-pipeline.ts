/**
 * Token Discovery Pipeline (Sprint 45 §12-16).
 *
 * Implements candidate token address validation, metadata enrichment,
 * supply models with confidence tracking, and canonical token lifecycle.
 */

import { TokenSupplyInfo } from '../types';

export type TokenLifecycleStatus = 'DISCOVERED' | 'VALIDATED' | 'ACTIVE' | 'INACTIVE' | 'SUSPICIOUS';

export interface DiscoveredToken {
  tokenId: string; // Mint address
  chainId: string;
  symbol: string;
  name: string;
  decimals: number;
  status: TokenLifecycleStatus;
  logoUrl?: string;
  description?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  supply: TokenSupplyInfo;
  firstSeenAt: string;
  updatedAt: string;
}

export class TokenDiscoveryPipeline {
  private static instance: TokenDiscoveryPipeline;
  private tokenRegistry: Map<string, DiscoveredToken> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): TokenDiscoveryPipeline {
    if (!TokenDiscoveryPipeline.instance) {
      TokenDiscoveryPipeline.instance = new TokenDiscoveryPipeline();
    }
    return TokenDiscoveryPipeline.instance;
  }

  private seedDefaults(): void {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    this.registerOrUpdateToken({
      tokenId: sentMint,
      chainId: 'solana',
      symbol: 'SOL',
      name: 'Wrapped SOL / Sentinel Native',
      decimals: 9,
      status: 'ACTIVE',
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      description: 'Solana Native Token',
      totalSupply: 580_000_000,
      circulatingSupply: 460_000_000,
      maxSupply: null,
      supplyConfidence: 1.0,
      supplySource: 'ONCHAIN_RPC',
    });

    this.registerOrUpdateToken({
      tokenId: usdcMint,
      chainId: 'solana',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      status: 'ACTIVE',
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      description: 'Circle USD Coin',
      totalSupply: 32_000_000_000,
      circulatingSupply: 32_000_000_000,
      maxSupply: null,
      supplyConfidence: 1.0,
      supplySource: 'ONCHAIN_RPC',
    });

    this.registerOrUpdateToken({
      tokenId: '3mA1...4c90',
      chainId: 'solana',
      symbol: 'CYBER',
      name: 'Cyber Core AI',
      decimals: 6,
      status: 'ACTIVE',
      description: 'Autonomous AI Cyber Agent',
      totalSupply: 100_000_000,
      circulatingSupply: 68_000_000,
      maxSupply: 100_000_000,
      supplyConfidence: 0.95,
      supplySource: 'ONCHAIN_RPC',
    });

    this.registerOrUpdateToken({
      tokenId: '9pW2...8b11',
      chainId: 'solana',
      symbol: 'SOLM',
      name: 'Solana Meme',
      decimals: 9,
      status: 'SUSPICIOUS',
      description: 'Community Meme Token',
      totalSupply: 1_000_000_000,
      circulatingSupply: 1_000_000_000,
      maxSupply: 1_000_000_000,
      supplyConfidence: 0.60,
      supplySource: 'TOKEN_METADATA',
    });
  }

  public validateAddress(address: string, chainId: string): boolean {
    if (!address || typeof address !== 'string') return false;
    if (chainId === 'solana') {
      return address.length >= 32 && address.length <= 44;
    }
    if (chainId === 'ethereum' || chainId === 'base') {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    return address.length >= 10;
  }

  public registerOrUpdateToken(params: {
    tokenId: string;
    chainId: string;
    symbol: string;
    name: string;
    decimals: number;
    status?: TokenLifecycleStatus;
    logoUrl?: string;
    description?: string;
    websiteUrl?: string;
    twitterHandle?: string;
    totalSupply: number;
    circulatingSupply?: number;
    maxSupply?: number | null;
    supplyConfidence?: number;
    supplySource?: string;
  }): DiscoveredToken {
    const existing = this.tokenRegistry.get(params.tokenId);
    const now = new Date().toISOString();

    const supply: TokenSupplyInfo = {
      tokenId: params.tokenId,
      totalSupply: params.totalSupply,
      circulatingSupply: params.circulatingSupply ?? params.totalSupply,
      maxSupply: params.maxSupply ?? null,
      supplyConfidence: params.supplyConfidence ?? 0.8,
      source: params.supplySource ?? 'ONCHAIN_RPC',
      updatedAt: now,
    };

    if (existing) {
      existing.symbol = params.symbol || existing.symbol;
      existing.name = params.name || existing.name;
      existing.decimals = params.decimals ?? existing.decimals;
      if (params.status) existing.status = params.status;
      if (params.logoUrl) existing.logoUrl = params.logoUrl;
      if (params.description) existing.description = params.description;
      existing.supply = supply;
      existing.updatedAt = now;
      return existing;
    }

    const token: DiscoveredToken = {
      tokenId: params.tokenId,
      chainId: params.chainId,
      symbol: params.symbol,
      name: params.name,
      decimals: params.decimals,
      status: params.status ?? 'DISCOVERED',
      logoUrl: params.logoUrl,
      description: params.description,
      websiteUrl: params.websiteUrl,
      twitterHandle: params.twitterHandle,
      supply,
      firstSeenAt: now,
      updatedAt: now,
    };

    this.tokenRegistry.set(params.tokenId, token);
    return token;
  }

  public getToken(tokenId: string): DiscoveredToken | undefined {
    return this.tokenRegistry.get(tokenId);
  }

  public listTokens(filter?: { status?: TokenLifecycleStatus; chainId?: string; limit?: number }): DiscoveredToken[] {
    let list = Array.from(this.tokenRegistry.values());
    if (filter?.status) list = list.filter((t) => t.status === filter.status);
    if (filter?.chainId) list = list.filter((t) => t.chainId === filter.chainId);
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  public reset(): void {
    this.tokenRegistry.clear();
    this.seedDefaults();
  }
}

export const tokenDiscoveryPipeline = TokenDiscoveryPipeline.getInstance();
