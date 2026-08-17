import { TokenCardData } from '@/components/ui/token-card';

export interface DiscoverToken {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  source: 'Pump.fun' | 'Raydium' | 'Meteora';
  age: string;
  bondingCurve: number;
  price: string;
  mcap: string;
  liquidity: string;
  volume24h: string;
  rawHolders: number;
  clusterHolders: number;
  top10Share: string;
  clusterTop10Share: string;
  creatorRugRate: string;
  riskLevel: 'low' | 'med' | 'high' | 'critical';
}

export const mockTokenCards: TokenCardData[] = [
  {
    name: 'Solana Sentinel',
    symbol: '$SENT',
    mint: '7xK99zK8mP2xQ5wN3a19',
    price: '$0.0425',
    priceChange24h: 34.2,
    mcap: '$14.2M',
    liquidity: '$820K',
    volume24h: '$4.2M',
    intelligenceScore: 94,
    badges: ['verified', 'trending', 'smart-money'],
    sparklineData: [30, 45, 60, 50, 75, 85, 90, 100],
  },
  {
    name: 'Cyber Core AI',
    symbol: '$CYBER',
    mint: '3mA1...4c90',
    price: '$0.1850',
    priceChange24h: 18.7,
    mcap: '$6.8M',
    liquidity: '$450K',
    volume24h: '$1.8M',
    intelligenceScore: 78,
    badges: ['ai-flagged', 'trending'],
    sparklineData: [40, 42, 50, 58, 62, 70, 78],
  },
  {
    name: 'Solana Meme',
    symbol: '$SOLM',
    mint: '9pW2...8b11',
    price: '$0.0084',
    priceChange24h: -12.4,
    mcap: '$840K',
    liquidity: '$120K',
    volume24h: '$340K',
    intelligenceScore: 32,
    badges: ['high-risk'],
    sparklineData: [90, 85, 70, 60, 50, 40, 35],
  },
  {
    name: 'Raydium Revival',
    symbol: '$RAYR',
    mint: '4kF8...1z55',
    price: '$0.5210',
    priceChange24h: 52.1,
    mcap: '$48.5M',
    liquidity: '$2.4M',
    volume24h: '$8.9M',
    intelligenceScore: 88,
    badges: ['verified'],
    sparklineData: [50, 65, 70, 80, 85, 95],
  },
];

export const mockDiscoverTokens: DiscoverToken[] = [
  {
    id: 'd1',
    name: 'Alpha Sentinel',
    symbol: '$ALPHA',
    mint: '7xK9...3a19',
    source: 'Pump.fun',
    age: '4m ago',
    bondingCurve: 88,
    price: '$0.0034',
    mcap: '$52.4K',
    liquidity: '$18.5K',
    volume24h: '$120K',
    rawHolders: 420,
    clusterHolders: 380,
    top10Share: '24.5%',
    clusterTop10Share: '26.1%',
    creatorRugRate: '0/8 past tokens',
    riskLevel: 'low',
  },
  {
    id: 'd2',
    name: 'Cyber Quantum',
    symbol: '$QUANT',
    mint: '3mA1...4c90',
    source: 'Raydium',
    age: '18m ago',
    bondingCurve: 100,
    price: '$0.0412',
    mcap: '$840K',
    liquidity: '$140K',
    volume24h: '$980K',
    rawHolders: 1420,
    clusterHolders: 890,
    top10Share: '48.2%',
    clusterTop10Share: '62.4%',
    creatorRugRate: '4/5 past tokens',
    riskLevel: 'critical',
  },
  {
    id: 'd3',
    name: 'Solana Velocity',
    symbol: '$VELO',
    mint: '9pW2...8b11',
    source: 'Pump.fun',
    age: '1h ago',
    bondingCurve: 94,
    price: '$0.0092',
    mcap: '$98.5K',
    liquidity: '$24.0K',
    volume24h: '$410K',
    rawHolders: 890,
    clusterHolders: 720,
    top10Share: '18.4%',
    clusterTop10Share: '19.2%',
    creatorRugRate: '1/3 past tokens',
    riskLevel: 'med',
  },
  {
    id: 'd4',
    name: 'Meteora Yield AI',
    symbol: '$MYAI',
    mint: '4kF8...1z55',
    source: 'Meteora',
    age: '3h ago',
    bondingCurve: 100,
    price: '$0.8400',
    mcap: '$12.4M',
    liquidity: '$1.8M',
    volume24h: '$4.2M',
    rawHolders: 6400,
    clusterHolders: 6100,
    top10Share: '14.2%',
    clusterTop10Share: '15.1%',
    creatorRugRate: '0/12 past tokens',
    riskLevel: 'low',
  },
];
