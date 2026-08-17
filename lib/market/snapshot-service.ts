import { MarketSnapshot } from './types';
import { Decimal } from '@/lib/math/decimal';

/**
 * Normalizes raw market feed parameters into precision MarketSnapshot objects.
 * Uses fixed-point Decimal math for prices, volumes, liquidity, and market caps.
 */
export function createMarketSnapshot(input: {
  tokenId: string;
  symbol: string;
  priceUsd: string | number;
  priceChange1m?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange24h?: number;
  volume5mUsd?: string | number;
  volume1hUsd?: string | number;
  volume24hUsd?: string | number;
  liquidityUsd?: string | number;
  marketCapUsd?: string | number;
  buys?: number;
  sells?: number;
  holders?: number;
  timestamp?: string;
}): MarketSnapshot {
  const priceDec = new Decimal(input.priceUsd);
  const vol5mDec = new Decimal(input.volume5mUsd ?? 0);
  const vol1hDec = new Decimal(input.volume1hUsd ?? 0);
  const vol24hDec = new Decimal(input.volume24hUsd ?? 0);
  const liqDec = new Decimal(input.liquidityUsd ?? 0);
  const mcapDec = new Decimal(input.marketCapUsd ?? 0);

  return {
    tokenId: input.tokenId,
    symbol: input.symbol,
    price: priceDec.toString(18),
    priceRaw: priceDec.raw,
    priceChange1m: input.priceChange1m ?? 0.0,
    priceChange5m: input.priceChange5m ?? 0.0,
    priceChange1h: input.priceChange1h ?? 0.0,
    priceChange24h: input.priceChange24h ?? 0.0,
    volume5m: vol5mDec.toString(18),
    volume1h: vol1hDec.toString(18),
    volume24h: vol24hDec.toString(18),
    liquidity: liqDec.toString(18),
    marketCap: mcapDec.toString(18),
    buys: input.buys ?? 0,
    sells: input.sells ?? 0,
    holders: input.holders ?? 0,
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

/**
 * Normalizes array of token market feeds into normalized MarketSnapshots.
 */
export function getMockMarketSnapshots(): MarketSnapshot[] {
  return [
    createMarketSnapshot({
      tokenId: 'solana-sol',
      symbol: 'SOL',
      priceUsd: '142.500000000000000000',
      priceChange1m: 0.12,
      priceChange5m: 0.45,
      priceChange1h: 1.25,
      priceChange24h: 4.20,
      volume5mUsd: '145200.00',
      volume1hUsd: '1850000.00',
      volume24hUsd: '42500000.00',
      liquidityUsd: '125000000.00',
      marketCapUsd: '66500000000.00',
      buys: 1420,
      sells: 980,
      holders: 1450200,
    }),
    createMarketSnapshot({
      tokenId: 'sentinel-sen',
      symbol: 'SENTINEL',
      priceUsd: '3.450000000000000000',
      priceChange1m: -0.05,
      priceChange5m: 1.20,
      priceChange1h: 5.40,
      priceChange24h: 18.50,
      volume5mUsd: '45000.00',
      volume1hUsd: '520000.00',
      volume24hUsd: '8400000.00',
      liquidityUsd: '18500000.00',
      marketCapUsd: '345000005.00',
      buys: 840,
      sells: 310,
      holders: 42100,
    }),
    createMarketSnapshot({
      tokenId: 'bonk-bonk',
      symbol: 'BONK',
      priceUsd: '0.000028450000000000',
      priceChange1m: 0.85,
      priceChange5m: 2.10,
      priceChange1h: -1.15,
      priceChange24h: 12.40,
      volume5mUsd: '89000.00',
      volume1hUsd: '1120000.00',
      volume24hUsd: '19800000.00',
      liquidityUsd: '24100000.00',
      marketCapUsd: '1840000000.00',
      buys: 3200,
      sells: 2150,
      holders: 689000,
    }),
  ];
}
