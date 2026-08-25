import { DiscoveryToken, DiscoveryFilter, TimeWindow } from './types';
import { calculateDiscoveryScore } from './score-engine';
import { calculateTrendingScore } from './trending-engine';

interface TokenSeed {
  name: string;
  symbol: string;
  mintPrefix: string;
  source: 'Pump.fun' | 'Raydium' | 'Meteora' | 'Orca';
  basePrice: number;
  baseLiquidity: number;
  baseMarketCap: number;
  baseVolume24h: number;
  targetCategory: 'new' | 'migrating' | 'graduated' | 'smart-money' | 'ai-picks';
  bondingProgress?: number;
  riskTier: 'low' | 'medium' | 'high';
  aiLabel: 'Bullish' | 'Breakout' | 'Bearish' | 'Neutral';
  aiReason: string;
  logoURI?: string;
}

const TOKEN_SEEDS: TokenSeed[] = [
  {
    name: 'Solana Sentinel AI',
    symbol: 'SENT',
    mintPrefix: '7xK99zK8mP2xQ5wN3a19',
    source: 'Raydium',
    basePrice: 3.45,
    baseLiquidity: 18500000,
    baseMarketCap: 345000000,
    baseVolume24h: 42500000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Institutional accumulation and expanding on-chain DEX volume',
  },
  {
    name: 'Neuro Quantum Mesh',
    symbol: 'QUANT',
    mintPrefix: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.0412,
    baseLiquidity: 120000,
    baseMarketCap: 840000,
    baseVolume24h: 3200000,
    targetCategory: 'migrating',
    bondingProgress: 88,
    riskTier: 'low',
    aiLabel: 'Breakout',
    aiReason: 'Approaching bonding curve completion with high buyer velocity',
  },
  {
    name: 'Bonk Doge Matrix',
    symbol: 'BONK',
    mintPrefix: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    source: 'Meteora',
    basePrice: 0.00002845,
    baseLiquidity: 24100000,
    baseMarketCap: 1840000000,
    baseVolume24h: 19800000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Neutral',
    aiReason: 'Established liquid trading pair with sustained retail volume',
  },
  {
    name: 'Alpha Matrix AI',
    symbol: 'ALPHA',
    mintPrefix: '1aM3z9K2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.0125,
    baseLiquidity: 64000,
    baseMarketCap: 420000,
    baseVolume24h: 1850000,
    targetCategory: 'migrating',
    bondingProgress: 64,
    riskTier: 'medium',
    aiLabel: 'Bullish',
    aiReason: 'Early momentum surge with rapid unique wallet accumulation',
  },
  {
    name: 'Apex Predator Protocol',
    symbol: 'APEX',
    mintPrefix: 'APeX9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Raydium',
    basePrice: 0.0245,
    baseLiquidity: 95000,
    baseMarketCap: 450000,
    baseVolume24h: 1450000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Raydium graduation with sustained institutional liquidity',
  },
  {
    name: 'Hyper Velocity SOL',
    symbol: 'HYPER',
    mintPrefix: 'HyPEr9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00185,
    baseLiquidity: 28400,
    baseMarketCap: 78000,
    baseVolume24h: 210000,
    targetCategory: 'migrating',
    bondingProgress: 94,
    riskTier: 'low',
    aiLabel: 'Breakout',
    aiReason: '94% bonding completion with relentless buy volume',
  },
  {
    name: 'Solana Neural Copilot',
    symbol: 'SOLAI',
    mintPrefix: 'SoLAi9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00042,
    baseLiquidity: 14200,
    baseMarketCap: 42000,
    baseVolume24h: 98000,
    targetCategory: 'new',
    bondingProgress: 24,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Rapid organically distributed buyer velocity on Pump.fun',
  },
  {
    name: 'Dogwifhat Classic',
    symbol: 'WIF',
    mintPrefix: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    source: 'Raydium',
    basePrice: 1.84,
    baseLiquidity: 32000000,
    baseMarketCap: 1840000000,
    baseVolume24h: 58000000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Tier 1 meme asset with cross-exchange market maker support',
  },
  {
    name: 'Popcat Protocol',
    symbol: 'POPCAT',
    mintPrefix: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    source: 'Raydium',
    basePrice: 0.72,
    baseLiquidity: 14000000,
    baseMarketCap: 720000000,
    baseVolume24h: 28000000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Neutral',
    aiReason: 'High liquidity ceiling with stable buy/sell equilibrium',
  },
  {
    name: 'Cyber Pepe AI',
    symbol: 'PEPE',
    mintPrefix: '2aK99zK8mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.000042,
    baseLiquidity: 38000,
    baseMarketCap: 185000,
    baseVolume24h: 420000,
    targetCategory: 'migrating',
    bondingProgress: 76,
    riskTier: 'medium',
    aiLabel: 'Breakout',
    aiReason: 'Viral social velocity with active whale accumulations',
  },
  {
    name: 'Book of Meme 2.0',
    symbol: 'BOME',
    mintPrefix: 'ukHH6c7mMyPWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    source: 'Raydium',
    basePrice: 0.0084,
    baseLiquidity: 8900000,
    baseMarketCap: 580000000,
    baseVolume24h: 18000000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Strong base consolidation with surging DEX swap frequency',
  },
  {
    name: 'Chroma Neon AI',
    symbol: 'CHROMA',
    mintPrefix: 'CHRoMa9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00085,
    baseLiquidity: 18500,
    baseMarketCap: 52000,
    baseVolume24h: 145000,
    targetCategory: 'migrating',
    bondingProgress: 52,
    riskTier: 'medium',
    aiLabel: 'Bullish',
    aiReason: 'Expanding holder count and rising buy pressure index',
  },
  {
    name: 'Vortex Quantum Router',
    symbol: 'VORTEX',
    mintPrefix: 'VoRTeK9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.0034,
    baseLiquidity: 42000,
    baseMarketCap: 195000,
    baseVolume24h: 520000,
    targetCategory: 'migrating',
    bondingProgress: 82,
    riskTier: 'low',
    aiLabel: 'Breakout',
    aiReason: 'Top smart money wallets accumulating before Raydium pool migration',
  },
  {
    name: 'Pulse Zero Network',
    symbol: 'PULSE',
    mintPrefix: 'PuLSe9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00018,
    baseLiquidity: 8400,
    baseMarketCap: 21000,
    baseVolume24h: 42000,
    targetCategory: 'new',
    bondingProgress: 12,
    riskTier: 'medium',
    aiLabel: 'Neutral',
    aiReason: 'Fresh token deployment on Pump.fun with initial retail interest',
  },
  {
    name: 'Catgirl Anime Sol',
    symbol: 'CATGIRL',
    mintPrefix: 'CaTgIRL9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Raydium',
    basePrice: 0.00048,
    baseLiquidity: 650000,
    baseMarketCap: 4800000,
    baseVolume24h: 1920000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Raydium AMM pair with multi-day high organic liquidity',
  },
  {
    name: 'Turbo Snail AI',
    symbol: 'TURBO',
    mintPrefix: 'TuRBo9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00142,
    baseLiquidity: 32000,
    baseMarketCap: 142000,
    baseVolume24h: 380000,
    targetCategory: 'migrating',
    bondingProgress: 72,
    riskTier: 'medium',
    aiLabel: 'Bullish',
    aiReason: 'Steady buy-side velocity with low sniper sell pressure',
  },
  {
    name: 'Zenith Oracle Engine',
    symbol: 'ZENITH',
    mintPrefix: 'ZeNiTH9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.0089,
    baseLiquidity: 82000,
    baseMarketCap: 520000,
    baseVolume24h: 1650000,
    targetCategory: 'migrating',
    bondingProgress: 96,
    riskTier: 'low',
    aiLabel: 'Breakout',
    aiReason: '96% bonding curve threshold cleared with accelerating volume',
  },
  {
    name: 'Nexus VIP Syndicate',
    symbol: 'NEXUS',
    mintPrefix: 'NeXuS9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Raydium',
    basePrice: 0.082,
    baseLiquidity: 420000,
    baseMarketCap: 3800000,
    baseVolume24h: 2400000,
    targetCategory: 'graduated',
    bondingProgress: 100,
    riskTier: 'low',
    aiLabel: 'Bullish',
    aiReason: 'Strong smart money net flow with locked LP pools',
  },
  {
    name: 'Nova Flash Network',
    symbol: 'NOVA',
    mintPrefix: 'NoVA9zK2xP5wN1a84mP2xQ5wN3a19',
    source: 'Pump.fun',
    basePrice: 0.00032,
    baseLiquidity: 11000,
    baseMarketCap: 34000,
    baseVolume24h: 78000,
    targetCategory: 'new',
    bondingProgress: 19,
    riskTier: 'medium',
    aiLabel: 'Neutral',
    aiReason: 'Early stage buy signals with active dev wallet holding limits',
  },
];

// Rotating Dynamic Launch Templates for continuous live new mint generation
const DYNAMIC_NEW_TEMPLATES = [
  { name: 'Kittens on Solana', symbol: 'KITTEN', prefix: 'KiTTen', price: 0.00015 },
  { name: 'Matrix Autonomous Agent', symbol: 'AGENT', prefix: 'AGeNT', price: 0.00042 },
  { name: 'Solana Moon Shot', symbol: 'MOON', prefix: 'MOoN', price: 0.00028 },
  { name: 'Dark Cyber Blade', symbol: 'BLADE', prefix: 'BLaDe', price: 0.00065 },
  { name: 'Infinite Liquidity AI', symbol: 'INFI', prefix: 'INFi', price: 0.00084 },
  { name: 'Shadow Protocol Zero', symbol: 'SHADOW', prefix: 'SHaDoW', price: 0.00031 },
  { name: 'Hyper Spark Sol', symbol: 'SPARK', prefix: 'SPaRk', price: 0.00019 },
  { name: 'Aegis Sentinel Defense', symbol: 'AEGIS', prefix: 'AeGiS', price: 0.00072 },
  { name: 'Super Nova Meme', symbol: 'SUPER', prefix: 'SuPeR', price: 0.00054 },
  { name: 'Echo Voice Synthesizer', symbol: 'ECHO', prefix: 'EcHo', price: 0.00039 },
  { name: 'Neon Cyber Samurai', symbol: 'SAMURAI', prefix: 'SaMuRai', price: 0.00048 },
  { name: 'Solana Diamond Hands', symbol: 'DIAMOND', prefix: 'DiaMoNd', price: 0.00092 },
];

function formatAge(minutes: number): string {
  if (minutes < 1) {
    const sec = Math.max(1, Math.round(minutes * 60));
    return `${sec}s ago`;
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m ago`;
  }
  if (minutes < 1440) {
    return `${Math.round(minutes / 60)}h ago`;
  }
  return `${Math.round(minutes / 1440)}d ago`;
}

/**
 * Generates an active, continuously dynamic token ecosystem.
 * All token ages, prices, volumes, and bonding progressions evolve smoothly with current time (Date.now()).
 */
export function getMockDiscoveryTokens(filter?: Partial<DiscoveryFilter>): DiscoveryToken[] {
  const window: TimeWindow = filter?.timeWindow || '15m';
  const now = Date.now();

  const generatedTokens: Omit<DiscoveryToken, 'discoveryScore'>[] = [];

  // 1. Generate 12 Brand New Micro-Launches (Age 2s to 12m)
  for (let i = 0; i < DYNAMIC_NEW_TEMPLATES.length; i++) {
    const tpl = DYNAMIC_NEW_TEMPLATES[i];
    // Offset each launch by staggered minutes/seconds relative to current time
    const ageSeconds = (i * 45) + Math.floor((now / 1000) % 45);
    const ageMinutes = Math.max(0.05, ageSeconds / 60);

    const priceWave = Math.sin((now / 8000) + i) * 0.15;
    const currentPrice = (tpl.price * (1 + priceWave));
    const txMultiplier = Math.max(1, Math.floor(15 - (i * 0.8)));
    const buysCount = 12 + (txMultiplier * 4) + Math.floor((now % 100000) / 4000);
    const sellsCount = Math.max(1, Math.floor(buysCount * 0.22));
    const volume5m = (currentPrice * buysCount * 450).toFixed(2);
    const volume24h = (parseFloat(volume5m) * (4 + i)).toFixed(2);
    const liquidity = (4500 + (i * 1200) + Math.sin(now / 5000 + i) * 300).toFixed(2);
    const marketCap = (parseFloat(liquidity) * (2.4 + (i * 0.2))).toFixed(2);
    const progress = Math.min(38, Math.max(2, Math.floor((i * 3) + ((now / 15000) % 5))));

    generatedTokens.push({
      id: `dt_launch_${tpl.symbol.toLowerCase()}_${Math.floor(now / 300000)}_${i}`,
      name: tpl.name,
      symbol: tpl.symbol,
      mint: `${tpl.prefix}${Math.floor(now / 300000)}PumpFun${i}MintAddress`,
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes,
      ageFormatted: formatAge(ageMinutes),
      priceUsd: currentPrice.toFixed(currentPrice < 0.001 ? 8 : 6),
      priceChange1m: Number(((8.5 + Math.sin(now / 6000 + i) * 4)).toFixed(1)),
      priceChange5m: Number(((22.0 + Math.cos(now / 9000 + i) * 8)).toFixed(1)),
      priceChange15m: Number(((45.0 + Math.sin(now / 12000 + i) * 15)).toFixed(1)),
      priceChange1h: Number(((65.0 + i * 5)).toFixed(1)),
      priceChange24h: Number(((95.0 + i * 12)).toFixed(1)),
      volume5mUsd: volume5m,
      volume1hUsd: (parseFloat(volume24h) * 0.35).toFixed(2),
      volume24hUsd: volume24h,
      volumeChange15mPct: Math.floor(180 + Math.sin(now / 7000 + i) * 90),
      liquidityUsd: liquidity,
      liquidityChange1hPct: Number((12.5 + Math.cos(now / 8000 + i) * 5).toFixed(1)),
      marketCapUsd: marketCap,
      buysCount,
      sellsCount,
      txCount15m: buysCount + sellsCount,
      txCount1h: (buysCount + sellsCount) * 3,
      buySellImbalancePct: Number((65 + Math.sin(now / 5000 + i) * 15).toFixed(1)),
      buyPressureRatio: Number((0.75 + Math.sin(now / 6000 + i) * 0.12).toFixed(2)),
      txAccelerationPct: Number((80 + Math.cos(now / 7000 + i) * 15).toFixed(1)),
      isNewToken: true,
      holdersCount: 24 + (i * 8) + Math.floor((now % 80000) / 5000),
      holderGrowth1hPct: Number((140 + Math.sin(now / 10000 + i) * 50).toFixed(1)),
      migrationProgress: progress,
      bondingStatus: 'bonding',
      devHoldingsPct: Number((3.5 + (i % 3) * 1.2).toFixed(1)),
      top10HoldingsPct: Number((18.0 + (i % 4) * 2.5).toFixed(1)),
      insiderHoldingsPct: Number((2.0 + (i % 2) * 1.5).toFixed(1)),
      sniperPercentage: Number((4.0 + (i % 3) * 1.5).toFixed(1)),
      bundlerPercentage: Number((1.0 + (i % 2)).toFixed(1)),
      riskScore: Math.floor(75 + (i % 15)),
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: false,
      isFreezeDisabled: true,
      aiSignalScore: Math.floor(82 + (i % 14)),
      aiSignalLabel: i % 2 === 0 ? 'Bullish' : 'Breakout',
      aiSignalReason: 'High organic buyer velocity and expanding unique wallet dispersion',
      smartMoneyCount: Math.floor(2 + (i % 4)),
      smartMoneyNetFlowUsd: Math.floor(4500 + (i * 1800)),
    });
  }

  // 2. Generate Base Seeded Ecosystem (Migrating, Graduated, Top Gainers, Smart Money)
  for (let j = 0; j < TOKEN_SEEDS.length; j++) {
    const seed = TOKEN_SEEDS[j];
    const ageOffsetMinutes = seed.targetCategory === 'new' ? 14 + j * 2
      : seed.targetCategory === 'migrating' ? 35 + j * 12
      : 120 + j * 60;

    const microWave = Math.sin((now / 10000) + (j * 1.5)) * 0.06;
    const currentPrice = seed.basePrice * (1 + microWave);

    const buysCount = Math.floor(180 + (j * 85) + ((now % 200000) / 1000));
    const sellsCount = Math.floor(buysCount * (seed.targetCategory === 'migrating' ? 0.3 : 0.45));
    const vol5m = (seed.baseVolume24h * 0.04 * (1 + microWave * 2)).toFixed(2);
    const vol24h = (seed.baseVolume24h * (1 + Math.cos(now / 15000 + j) * 0.04)).toFixed(2);
    const liquidity = (seed.baseLiquidity * (1 + Math.sin(now / 20000 + j) * 0.02)).toFixed(2);
    const marketCap = (seed.baseMarketCap * (1 + microWave)).toFixed(2);

    let progress = seed.bondingProgress ?? 100;
    if (seed.targetCategory === 'migrating') {
      // Dynamic fluctuating migration between 45% and 98%
      const progWave = Math.floor((now / 12000 + j * 7) % 55);
      progress = Math.min(99, Math.max(45, 45 + progWave));
    }

    generatedTokens.push({
      id: `dt_seed_${seed.symbol.toLowerCase()}`,
      name: seed.name,
      symbol: seed.symbol,
      mint: `${seed.mintPrefix}${seed.source === 'Pump.fun' ? 'pump' : 'sol'}`,
      chain: 'solana',
      source: seed.source,
      ageMinutes: ageOffsetMinutes,
      ageFormatted: formatAge(ageOffsetMinutes),
      priceUsd: currentPrice.toFixed(currentPrice < 0.001 ? 8 : 6),
      priceChange1m: Number(((2.4 + Math.sin(now / 5000 + j) * 2)).toFixed(1)),
      priceChange5m: Number(((8.2 + Math.cos(now / 8000 + j) * 4)).toFixed(1)),
      priceChange15m: Number(((18.5 + Math.sin(now / 11000 + j) * 8)).toFixed(1)),
      priceChange1h: Number(((42.0 + j * 4)).toFixed(1)),
      priceChange24h: Number(((120.0 + j * 18)).toFixed(1)),
      volume5mUsd: vol5m,
      volume1hUsd: (parseFloat(vol24h) * 0.18).toFixed(2),
      volume24hUsd: vol24h,
      volumeChange15mPct: Math.floor(240 + Math.sin(now / 9000 + j) * 120),
      liquidityUsd: liquidity,
      liquidityChange1hPct: Number((15.4 + Math.cos(now / 12000 + j) * 6).toFixed(1)),
      marketCapUsd: marketCap,
      buysCount,
      sellsCount,
      txCount15m: Math.floor((buysCount + sellsCount) * 0.25),
      txCount1h: buysCount + sellsCount,
      buySellImbalancePct: Number((62.0 + Math.sin(now / 7000 + j) * 18).toFixed(1)),
      buyPressureRatio: Number((0.72 + Math.sin(now / 8000 + j) * 0.14).toFixed(2)),
      txAccelerationPct: Number((72.0 + Math.cos(now / 9000 + j) * 20).toFixed(1)),
      isNewToken: seed.targetCategory === 'new',
      holdersCount: Math.floor(320 + (j * 180) + ((now % 150000) / 2000)),
      holderGrowth1hPct: Number((45.0 + Math.sin(now / 15000 + j) * 25).toFixed(1)),
      migrationProgress: progress,
      bondingStatus: progress >= 100 ? 'graduated' : progress >= 40 ? 'migrating' : 'bonding',
      devHoldingsPct: Number((2.4 + (j % 3) * 0.8).toFixed(1)),
      top10HoldingsPct: Number((16.0 + (j % 4) * 1.8).toFixed(1)),
      insiderHoldingsPct: Number((1.5 + (j % 2) * 1.2).toFixed(1)),
      sniperPercentage: Number((3.5 + (j % 3) * 1.0).toFixed(1)),
      bundlerPercentage: Number((0.5 + (j % 2) * 0.5).toFixed(1)),
      riskScore: Math.floor(82 + (j % 16)),
      riskTier: seed.riskTier,
      isMintRenounced: true,
      isLiquidityLocked: progress >= 100,
      isFreezeDisabled: true,
      aiSignalScore: Math.floor(84 + (j % 14)),
      aiSignalLabel: seed.aiLabel,
      aiSignalReason: seed.aiReason,
      smartMoneyCount: Math.floor(5 + (j * 2)),
      smartMoneyNetFlowUsd: Math.floor(28000 + (j * 14000)),
    });
  }

  // Score each token using the scoring engine
  const scoredTokens: DiscoveryToken[] = generatedTokens.map((token) => {
    const rawInput = {
      ageMinutes: token.ageMinutes,
      priceChangeWindow: token.priceChange15m,
      volumeWindowUsd: parseFloat(token.volume1hUsd || '10000'),
      volumeAccelerationPct: token.volumeChange15mPct,
      liquidityUsd: parseFloat(token.liquidityUsd || '50000'),
      liquidityChangePct: token.liquidityChange1hPct,
      buysCount: token.buysCount,
      sellsCount: token.sellsCount,
      // The score engine needs numbers. 0 is its neutral input here — these
      // feed a weighting, they are not displayed, so an unknown contributing
      // nothing is correct. Display paths render `—` instead.
      holdersCount: token.holdersCount ?? 0,
      holderGrowthPct: token.holderGrowth1hPct ?? 0,
      txCount1h: token.txCount1h,
      buySellImbalancePct: token.buySellImbalancePct,
      buyPressureRatio: token.buyPressureRatio,
      txAccelerationPct: token.txAccelerationPct,
      isNewToken: token.isNewToken,
    };
    const discoveryScore = calculateDiscoveryScore(rawInput, window);
    return {
      ...token,
      discoveryScore,
    };
  });

  // Apply Range Filters first
  const filtered = filterDiscoveryTokens(scoredTokens, filter);

  // Section-specific routing and sorting
  if (filter?.section === 'trending') {
    return [...filtered].sort((a, b) => {
      const scoreA = calculateTrendingScore(a, window).trendingRankScore;
      const scoreB = calculateTrendingScore(b, window).trendingRankScore;
      return scoreB - scoreA;
    });
  } else if (filter?.section === 'new') {
    return [...filtered].sort((a, b) => a.ageMinutes - b.ageMinutes);
  } else if (filter?.section === 'migrating') {
    return filtered
      .filter((t) => (t.migrationProgress ?? 0) >= 40 && (t.migrationProgress ?? 0) < 100)
      .sort((a, b) => (b.migrationProgress ?? 0) - (a.migrationProgress ?? 0));
  } else if (filter?.section === 'graduated') {
    return filtered
      .filter((t) => (t.migrationProgress ?? 0) >= 100 || t.bondingStatus === 'graduated')
      .sort((a, b) => parseFloat(b.marketCapUsd) - parseFloat(a.marketCapUsd));
  } else if (filter?.section === 'smart-money') {
    return [...filtered].sort((a, b) => (b.smartMoneyCount ?? 0) - (a.smartMoneyCount ?? 0));
  } else if (filter?.section === 'ai-picks') {
    return [...filtered].sort((a, b) => (b.aiSignalScore ?? 0) - (a.aiSignalScore ?? 0));
  } else if (filter?.section === 'top-gainers') {
    return [...filtered].sort((a, b) => b.priceChange24h - a.priceChange24h);
  } else if (filter?.section === 'top-losers') {
    return [...filtered].sort((a, b) => a.priceChange24h - b.priceChange24h);
  } else if (filter?.section === 'momentum') {
    return filtered.filter((t) => t.priceChange15m > 10.0);
  } else if (filter?.section === 'volume') {
    return filtered.filter((t) => t.volumeChange15mPct > 100);
  } else if (filter?.section === 'liquidity') {
    return filtered.filter((t) => t.liquidityChange1hPct > 10);
  }

  // Default: Sort by composite total score descending
  return filtered.sort((a, b) => b.discoveryScore.totalScore - a.discoveryScore.totalScore);
}

export function filterDiscoveryTokens(
  tokens: DiscoveryToken[],
  filter?: Partial<DiscoveryFilter>
): DiscoveryToken[] {
  if (!filter) return tokens;

  return tokens.filter((t) => {
    const mcap = parseFloat(t.marketCapUsd);
    const liq = parseFloat(t.liquidityUsd);
    const vol = parseFloat(t.volume24hUsd);

    // Market Cap
    if (filter.marketCapMin !== undefined && mcap < filter.marketCapMin) return false;
    if (filter.marketCapMax !== undefined && mcap > filter.marketCapMax) return false;

    // Liquidity
    if (filter.liquidityMin !== undefined && liq < filter.liquidityMin) return false;
    if (filter.liquidityMax !== undefined && liq > filter.liquidityMax) return false;

    // Volume (24h)
    if (filter.volumeMin !== undefined && vol < filter.volumeMin) return false;
    if (filter.volumeMax !== undefined && vol > filter.volumeMax) return false;

    // Token Age (minutes)
    if (filter.ageMinutesMin !== undefined && t.ageMinutes < filter.ageMinutesMin) return false;
    if (filter.ageMinutesMax !== undefined && t.ageMinutes > filter.ageMinutesMax) return false;

    // Price Change (15m %)
    if (filter.priceChangeMin !== undefined && t.priceChange15m < filter.priceChangeMin) return false;
    if (filter.priceChangeMax !== undefined && t.priceChange15m > filter.priceChangeMax) return false;

    // Volume Change (15m %)
    if (filter.volumeChangeMin !== undefined && t.volumeChange15mPct < filter.volumeChangeMin) return false;
    if (filter.volumeChangeMax !== undefined && t.volumeChange15mPct > filter.volumeChangeMax) return false;

    // Holders.
    //
    // A token with no published holder count is excluded when the user sets a
    // holder filter: it cannot be shown to satisfy the condition, and treating
    // unknown as 0 (or as passing) would silently misreport the filter.
    if (filter.holdersMin !== undefined) {
      if (t.holdersCount === undefined || t.holdersCount < filter.holdersMin) return false;
    }
    if (filter.holdersMax !== undefined) {
      if (t.holdersCount === undefined || t.holdersCount > filter.holdersMax) return false;
    }

    // Top 10 & Dev Holdings
    if (filter.top10HoldingsMax !== undefined && (t.top10HoldingsPct ?? 0) > filter.top10HoldingsMax) return false;
    if (filter.devHoldingsMax !== undefined && (t.devHoldingsPct ?? 0) > filter.devHoldingsMax) return false;

    // Safety / Risk
    if (filter.minRiskScore !== undefined && (t.riskScore ?? 0) < filter.minRiskScore) return false;
    if (filter.mintRenouncedOnly && !t.isMintRenounced) return false;
    if (filter.liquidityLockedOnly && !t.isLiquidityLocked) return false;

    // Launchpads
    if (filter.launchpads && filter.launchpads.length > 0 && !filter.launchpads.includes(t.source)) {
      return false;
    }

    // Discovery Score
    if (filter.discoveryScoreMin !== undefined && t.discoveryScore.totalScore < filter.discoveryScoreMin) return false;
    if (filter.discoveryScoreMax !== undefined && t.discoveryScore.totalScore > filter.discoveryScoreMax) return false;

    // Search query matches token name, symbol, or mint
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase().trim();
      const matchesQuery =
        t.name.toLowerCase().includes(query) ||
        t.symbol.toLowerCase().includes(query) ||
        t.mint.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }

    return true;
  });
}
