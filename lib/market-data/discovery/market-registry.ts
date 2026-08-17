/**
 * Canonical Market Registry Engine (Sprint 45 §3-7).
 *
 * Implements $1 \text{ Token} \neq 1 \text{ Market}$ multi-market indexing,
 * deterministic identity uniqueness, and market status lifecycle.
 */

import { Market, MarketStatus, MarketDiscoverySource } from '../types';

export class CanonicalMarketRegistry {
  private static instance: CanonicalMarketRegistry;
  private markets: Map<string, Market> = new Map();
  private tokenToMarkets: Map<string, Set<string>> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): CanonicalMarketRegistry {
    if (!CanonicalMarketRegistry.instance) {
      CanonicalMarketRegistry.instance = new CanonicalMarketRegistry();
    }
    return CanonicalMarketRegistry.instance;
  }

  private seedDefaults(): void {
    // Seed Sentinel ($SENT) with multiple markets (Raydium + Orca + Meteora)
    const sentMint = 'So11111111111111111111111111111111111111112';
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const usdtMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

    this.registerMarket({
      chainId: 'solana',
      protocol: 'raydium_cpmm',
      marketType: 'CPMM',
      address: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      baseTokenId: sentMint,
      quoteTokenId: usdcMint,
      feeBps: 25,
      status: 'ACTIVE',
      source: 'ONCHAIN',
    });

    this.registerMarket({
      chainId: 'solana',
      protocol: 'orca_whirlpool',
      marketType: 'CONCENTRATED',
      address: '7xK9OrcaWhirlpoolPoolSentUsdc99a12',
      baseTokenId: sentMint,
      quoteTokenId: usdcMint,
      feeBps: 30,
      status: 'ACTIVE',
      source: 'ONCHAIN',
    });

    this.registerMarket({
      chainId: 'solana',
      protocol: 'meteora',
      marketType: 'CPMM',
      address: '9pW2MeteoraPoolSentUsdt44c1',
      baseTokenId: sentMint,
      quoteTokenId: usdtMint,
      feeBps: 20,
      status: 'ACTIVE',
      source: 'INDEXER',
    });
  }

  public generateMarketId(chainId: string, protocol: string, address: string): string {
    return `${chainId.toLowerCase()}:${protocol.toLowerCase()}:${address.toLowerCase()}`;
  }

  public registerMarket(params: {
    chainId: string;
    protocol: string;
    marketType: 'CPMM' | 'CONCENTRATED' | 'ORDERBOOK' | 'STABLE_SWAP';
    address: string;
    baseTokenId: string;
    quoteTokenId: string;
    feeBps?: number;
    status?: MarketStatus;
    source?: MarketDiscoverySource;
    metadata?: Record<string, unknown>;
  }): Market {
    const marketId = this.generateMarketId(params.chainId, params.protocol, params.address);

    const existing = this.markets.get(marketId);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      if (params.status) existing.status = params.status;
      return existing;
    }

    const market: Market = {
      marketId,
      chainId: params.chainId.toLowerCase(),
      protocol: params.protocol.toLowerCase(),
      marketType: params.marketType,
      address: params.address,
      baseTokenId: params.baseTokenId,
      quoteTokenId: params.quoteTokenId,
      feeBps: params.feeBps ?? 25,
      status: params.status ?? 'DISCOVERED',
      source: params.source ?? 'ONCHAIN',
      metadata: params.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.markets.set(marketId, market);

    // Map base token -> markets
    if (!this.tokenToMarkets.has(params.baseTokenId)) {
      this.tokenToMarkets.set(params.baseTokenId, new Set());
    }
    this.tokenToMarkets.get(params.baseTokenId)!.add(marketId);

    // Map quote token -> markets
    if (!this.tokenToMarkets.has(params.quoteTokenId)) {
      this.tokenToMarkets.set(params.quoteTokenId, new Set());
    }
    this.tokenToMarkets.get(params.quoteTokenId)!.add(marketId);

    return market;
  }

  public getMarket(marketId: string): Market | undefined {
    return this.markets.get(marketId.toLowerCase());
  }

  public getMarketsForToken(tokenId: string): Market[] {
    const marketIds = this.tokenToMarkets.get(tokenId);
    if (!marketIds) return [];
    const results: Market[] = [];
    for (const id of marketIds) {
      const m = this.markets.get(id);
      if (m) results.push(m);
    }
    return results;
  }

  public listMarkets(filter?: {
    chainId?: string;
    protocol?: string;
    status?: MarketStatus;
    limit?: number;
  }): Market[] {
    let list = Array.from(this.markets.values());
    if (filter?.chainId) {
      const cid = filter.chainId.toLowerCase();
      list = list.filter((m) => m.chainId === cid);
    }
    if (filter?.protocol) {
      const proto = filter.protocol.toLowerCase();
      list = list.filter((m) => m.protocol === proto);
    }
    if (filter?.status) list = list.filter((m) => m.status === filter.status);
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  public updateMarketStatus(marketId: string, status: MarketStatus): Market {
    const market = this.markets.get(marketId.toLowerCase());
    if (!market) {
      throw new Error(`Market not found: ${marketId}`);
    }
    market.status = status;
    market.updatedAt = new Date().toISOString();
    return market;
  }

  public reset(): void {
    this.markets.clear();
    this.tokenToMarkets.clear();
    this.seedDefaults();
  }
}

export const canonicalMarketRegistry = CanonicalMarketRegistry.getInstance();
