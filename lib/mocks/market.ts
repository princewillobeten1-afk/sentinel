import type {
  MarketSummary,
  TokenMarketData,
  CandlestickPoint,
  TokenTradeRecord,
} from '@/lib/market/types';

export const mockMarketSummary: MarketSummary = {
  solPriceUsd: 142.5,
  solChange24h: 4.2,
  totalMarketCapUsd: 14_250_000,
  totalLiquidityUsd: 820_000,
  totalVolume24hUsd: 4_820_000,
  activePools: 18,
  trendingTokens: ['$SENT', '$CYBER', '$RAYR'],
  averageSpread: 0.12,
  marketSentiment: 'bullish',
  dataSource: 'mock',
  updatedAt: new Date().toISOString(),
  freshness: 'fresh',
};

export const mockTokenMarketData: Record<string, TokenMarketData> = {
  SENT: {
    symbol: '$SENT',
    name: 'Solana Sentinel',
    mint: '7xK99zK8mP2xQ5wN3a19',
    network: 'solana',
    priceUsd: 0.0425,
    priceChange24h: 34.2,
    marketCapUsd: 14_250_000,
    liquidityUsd: 820_000,
    volume24hUsd: 4_200_000,
    holdersCount: 12_900,
    holderChange24h: 4.2,
    marketDepthUsd: 340_000,
    tvlUsd: 980_000,
    circulatingSupply: 335_294_000,
    totalSupply: 420_000_000,
    description: 'A Solana-native intelligence token with streamed trade awareness and liquidity tooling.',
    website: 'https://sentinel.example',
    explorerUrl: 'https://explorer.solana.com/address/7xK99zK8mP2xQ5wN3a19',
    poolInfo: [
      {
        id: 'p1',
        dex: 'Raydium',
        feeTier: '0.25%',
        baseSymbol: 'SOL',
        quoteSymbol: '$SENT',
        tvlUsd: 420_000,
        feeUsd: 95,
        depthUsd: 310_000,
        minOrderSizeUsd: 250,
        maxOrderSizeUsd: 45_000,
      },
    ],
    metrics: {
      buySellRatio: 1.26,
      bidAskSpread: 0.12,
      volatility24h: 5.8,
      averageTradeSizeUsd: 2_400,
      topHoldersShare: 28.4,
    },
    metadata: { category: 'analytics', source: 'mock' },
    tokenModel: {
      id: 'sentinel-token',
      chain: 'solana',
      address: '7xK99zK8mP2xQ5wN3a19',
      symbol: '$SENT',
      name: 'Solana Sentinel',
      decimals: 9,
      logoUri: 'https://assets.sentinel.example/logo.png',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { category: 'analytics', ecosystem: 'Solana' },
    },
    updatedAt: new Date().toISOString(),
    freshness: 'fresh',
  },
};

export const mockTokenCandles: Record<string, CandlestickPoint[]> = {
  SENT: [
    { time: '11:20', open: 0.041, high: 0.043, low: 0.040, close: 0.042, volume: 12_400 },
    { time: '11:25', open: 0.042, high: 0.044, low: 0.041, close: 0.043, volume: 15_100 },
    { time: '11:30', open: 0.043, high: 0.0445, low: 0.0415, close: 0.0425, volume: 13_700 },
    { time: '11:35', open: 0.0425, high: 0.044, low: 0.041, close: 0.0432, volume: 14_600 },
    { time: '11:40', open: 0.0432, high: 0.045, low: 0.042, close: 0.044, volume: 18_200 },
    { time: '11:45', open: 0.044, high: 0.0448, low: 0.0425, close: 0.0442, volume: 11_500 },
  ],
};

export const mockRecentTrades: Record<string, TokenTradeRecord[]> = {
  SENT: [
    { id: 'tr1', side: 'buy', sizeUsd: '$103.25', priceUsd: '$0.0425', time: '12s ago', walletLabel: '4zW8...9kL2', source: 'Raydium' },
    { id: 'tr2', side: 'sell', sizeUsd: '$34.00', priceUsd: '$0.0424', time: '28s ago', walletLabel: '7xK9...3a19', source: 'Serum' },
    { id: 'tr3', side: 'buy', sizeUsd: '$212.50', priceUsd: '$0.0425', time: '42s ago', walletLabel: '1aM3...2b88', source: 'Raydium' },
  ],
};
