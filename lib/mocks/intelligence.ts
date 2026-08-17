/**
 * Mock Intelligence Data
 *
 * Rich mock data for the 4 existing tokens (SENT, QUANT, BONK, ALPHA).
 * Each gets realistic engine inputs that produce meaningful intelligence reports.
 *
 * Scenario coverage:
 * - SENT: Healthy profile, good liquidity, broad holders
 * - QUANT: New token, missing creator data, elevated concentration
 * - BONK: Established, concentrated ownership, strong liquidity
 * - ALPHA: Explosive new launch, low liquidity, high activity concentration
 */

import type { ReportInput } from '@/lib/intelligence/report-generator';
import type { TokenIdentity } from '@/lib/intelligence/types';
import { processActivityPipeline } from '@/lib/activity/pipeline';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';

const now = new Date().toISOString();

// ── Token Identities ──

export const MOCK_TOKENS: Record<string, TokenIdentity> = {
  SENT: {
    id: 'dt_sentinel',
    symbol: 'SENT',
    name: 'Solana Sentinel Token',
    address: '7xK99zK8mP2xQ5wN3a19',
    chain: 'solana',
    logoUri: 'https://assets.sentinel.example/logo.png',
  },
  QUANT: {
    id: 'dt_quantum',
    symbol: 'QUANT',
    name: 'Cyber Quantum AI',
    address: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19TestMint',
    chain: 'solana',
  },
  BONK: {
    id: 'dt_bonk',
    symbol: 'BONK',
    name: 'Bonk Doge Token',
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    chain: 'solana',
    logoUri: 'https://assets.bonk.example/logo.png',
  },
  ALPHA: {
    id: 'dt_alpha',
    symbol: 'ALPHA',
    name: 'Alpha Matrix AI',
    address: '1aM3z9K2xP5wN1a84mP2xQ5wN3a19Alpha',
    chain: 'solana',
  },
};

// ── Full Report Inputs ──

export function getMockReportInput(symbol: string): ReportInput | null {
  const sym = symbol.toUpperCase();
  let baseInput: ReportInput | null = null;

  switch (sym) {
    case 'SENT':
      baseInput = SENT_INPUT;
      break;
    case 'QUANT':
      baseInput = QUANT_INPUT;
      break;
    case 'BONK':
      baseInput = BONK_INPUT;
      break;
    case 'ALPHA':
      baseInput = ALPHA_INPUT;
      break;
    default:
      return null;
  }

  if (baseInput && !baseInput.organicActivity) {
    if (sym === 'SENT') {
      const data = getSentActivityData();
      const pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context });
      baseInput.organicActivity = pipelineRes.organicAssessment;
      baseInput.insiderReport = pipelineRes.insiderReport;
    } else if (sym === 'QUANT') {
      const data = getQuantActivityData();
      const pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context });
      baseInput.organicActivity = pipelineRes.organicAssessment;
      baseInput.insiderReport = pipelineRes.insiderReport;
    } else if (sym === 'BONK') {
      const data = getBonkActivityData();
      const pipelineRes = processActivityPipeline({ trades: data.trades, context: data.context });
      baseInput.organicActivity = pipelineRes.organicAssessment;
      baseInput.insiderReport = pipelineRes.insiderReport;
    } else if (sym === 'ALPHA') {
      const data = getAlphaActivityData();
      const pipelineRes = processActivityPipeline({
        trades: data.trades,
        context: data.context,
        currentPositionsUsd: data.currentPositionsUsd,
        realizedPnlUsd: data.realizedPnlUsd,
        unrealizedPnlUsd: data.unrealizedPnlUsd,
      });
      baseInput.organicActivity = pipelineRes.organicAssessment;
      baseInput.insiderReport = pipelineRes.insiderReport;
    }
  }

  return baseInput;
}


export function getAllMockSymbols(): string[] {
  return ['SENT', 'QUANT', 'BONK', 'ALPHA'];
}

// ── SENT: Healthy profile ──
const SENT_INPUT: ReportInput = {
  token: MOCK_TOKENS.SENT,
  market: {
    priceUsd: 3.45,
    priceChange1h: 4.2,
    priceChange24h: 18.5,
    volume1hUsd: 1_850_000,
    volume24hUsd: 42_500_000,
    liquidityUsd: 18_500_000,
    marketCapUsd: 345_000_000,
    buysCount: 1420,
    sellsCount: 980,
    holdersCount: 42_100,
    volatility24h: 5.8,
    averageTradeSizeUsd: 2_400,
    buySellRatio: 1.45,
    bidAskSpread: 0.12,
    dataTimestamp: now,
  },
  liquidity: {
    totalLiquidityUsd: 18_500_000,
    liquidityChange1hPct: 2.3,
    liquidityChange24hPct: 8.5,
    pools: [
      { id: 'p1', dex: 'Raydium', tvlUsd: 12_000_000, feeTier: 0.25, shareOfTotal: 0.65 },
      { id: 'p2', dex: 'Orca', tvlUsd: 4_500_000, feeTier: 0.30, shareOfTotal: 0.24 },
      { id: 'p3', dex: 'Meteora', tvlUsd: 2_000_000, feeTier: 0.20, shareOfTotal: 0.11 },
    ],
    dataTimestamp: now,
  },
  ownership: {
    holdersCount: 42_100,
    top1HolderPct: 8.2,
    top5HolderPct: 22.5,
    top10HolderPct: 31.4,
    holderGrowthPct: 24.5,
    distribution: [
      { label: '>1%', count: 3, totalSharePct: 12.8 },
      { label: '0.1-1%', count: 28, totalSharePct: 18.6 },
      { label: '0.01-0.1%', count: 450, totalSharePct: 25.2 },
      { label: '<0.01%', count: 41_619, totalSharePct: 43.4 },
    ],
    dataTimestamp: now,
    dataCompleteness: 0.92,
  },
  creator: {
    creatorAddress: 'Crtr5xK99zK8mP2xQ5wN3a19SentCreator',
    creationTimestamp: '2024-11-15T08:30:00Z',
    creationTx: '4rXkz9K2xP5wN1a8SentCreationTx',
    knownLaunches: 2,
    historyAvailable: true,
    dataTimestamp: now,
  },
  activity: {
    totalTransactions: 2400,
    uniqueWallets: 1850,
    repeatWalletRatio: 0.22,
    topWalletTxShare: 0.04,
    buysCount: 1420,
    sellsCount: 980,
    avgTxSizeUsd: 2400,
    txSizeStdDev: 1800,
    volumeConcentration: 0.18,
    temporalClustering: 0.25,
    dataTimestamp: now,
  },
  contract: {
    tokenId: 'dt_sentinel',
    chain: 'solana',
    name: 'Solana Sentinel Token',
    symbol: 'SENT',
    mintAuthorityStatus: 'REVOKED',
    freezeAuthorityStatus: 'REVOKED',
    totalSupply: '420000000',
    circulatingSupply: '335294000',
    supplyChangeable: false,
    metadataUri: 'https://arweave.net/sentinel-metadata',
    metadataChangeable: false,
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    isUpgradeable: false,
    dataTimestamp: now,
  },
  tokenSecurity: {
    tokenId: 'dt_sentinel',
    chain: 'solana',
    dataTimestamp: now,
    security: { isToken2022: false, transferFeeEnable: false, nonTransferable: false, freezeable: false },
  },
  exitability: {
    liquidityUsd: 18_500_000,
    poolDepthUsd: 12_000_000,
    volume24hUsd: 42_500_000,
    volume1hUsd: 1_850_000,
    priceUsd: 3.45,
    feeTierPct: 0.25,
    dataTimestamp: now,
  },
};

// ── QUANT: New token, missing creator data ──
const QUANT_INPUT: ReportInput = {
  token: MOCK_TOKENS.QUANT,
  market: {
    priceUsd: 0.0412,
    priceChange1h: 22.5,
    priceChange24h: 340.0,
    volume1hUsd: 640_000,
    volume24hUsd: 3_200_000,
    liquidityUsd: 120_000,
    marketCapUsd: 840_000,
    buysCount: 840,
    sellsCount: 190,
    holdersCount: 1840,
    volatility24h: 42.5,
    averageTradeSizeUsd: 620,
    buySellRatio: 4.42,
    bidAskSpread: 1.85,
    dataTimestamp: now,
  },
  liquidity: {
    totalLiquidityUsd: 120_000,
    liquidityChange1hPct: 15.0,
    liquidityChange24hPct: 120.0,
    pools: [
      { id: 'qp1', dex: 'Pump.fun', tvlUsd: 120_000, feeTier: 1.0, shareOfTotal: 1.0 },
    ],
    dataTimestamp: now,
  },
  ownership: {
    holdersCount: 1840,
    top1HolderPct: 18.5,
    top5HolderPct: 42.8,
    top10HolderPct: 58.2,
    holderGrowthPct: 62.0,
    distribution: [
      { label: '>1%', count: 5, totalSharePct: 28.5 },
      { label: '0.1-1%', count: 42, totalSharePct: 29.7 },
      { label: '<0.1%', count: 1793, totalSharePct: 41.8 },
    ],
    dataTimestamp: now,
    dataCompleteness: 0.75,
  },
  // Creator: intentionally omitted → "Unknown" status
  activity: {
    totalTransactions: 1030,
    uniqueWallets: 420,
    repeatWalletRatio: 0.58,
    topWalletTxShare: 0.12,
    buysCount: 840,
    sellsCount: 190,
    avgTxSizeUsd: 620,
    txSizeStdDev: 450,
    volumeConcentration: 0.42,
    temporalClustering: 0.55,
    dataTimestamp: now,
  },
  contract: {
    tokenId: 'dt_quantum',
    chain: 'solana',
    name: 'Cyber Quantum AI',
    symbol: 'QUANT',
    mintAuthorityStatus: 'ACTIVE',
    mintAuthorityAddress: 'QntMintAuth3mR8z9K2xP5wN1a84',
    freezeAuthorityStatus: 'ACTIVE',
    freezeAuthorityAddress: 'QntFrzAuth3mR8z9K2xP5wN1a84',
    totalSupply: '1000000000',
    supplyChangeable: true,
    metadataChangeable: true,
    dataTimestamp: now,
  },
  tokenSecurity: {
    tokenId: 'dt_quantum',
    chain: 'solana',
    dataTimestamp: now,
    security: { isToken2022: false, transferFeeEnable: false, nonTransferable: false, freezeable: true },
  },
  exitability: {
    liquidityUsd: 120_000,
    poolDepthUsd: 120_000,
    volume24hUsd: 3_200_000,
    volume1hUsd: 640_000,
    priceUsd: 0.0412,
    feeTierPct: 1.0,
    dataTimestamp: now,
  },
};

// ── BONK: Established, concentrated ownership ──
const BONK_INPUT: ReportInput = {
  token: MOCK_TOKENS.BONK,
  market: {
    priceUsd: 0.00002845,
    priceChange1h: 1.2,
    priceChange24h: 12.4,
    volume1hUsd: 1_120_000,
    volume24hUsd: 19_800_000,
    liquidityUsd: 24_100_000,
    marketCapUsd: 1_840_000_000,
    buysCount: 3200,
    sellsCount: 2150,
    holdersCount: 689_000,
    volatility24h: 3.2,
    averageTradeSizeUsd: 3_700,
    buySellRatio: 1.49,
    bidAskSpread: 0.08,
    dataTimestamp: now,
  },
  liquidity: {
    totalLiquidityUsd: 24_100_000,
    liquidityChange1hPct: 0.8,
    liquidityChange24hPct: 4.2,
    pools: [
      { id: 'bp1', dex: 'Raydium', tvlUsd: 14_000_000, feeTier: 0.25, shareOfTotal: 0.58 },
      { id: 'bp2', dex: 'Orca', tvlUsd: 6_500_000, feeTier: 0.30, shareOfTotal: 0.27 },
      { id: 'bp3', dex: 'Meteora', tvlUsd: 3_600_000, feeTier: 0.20, shareOfTotal: 0.15 },
    ],
    dataTimestamp: now,
  },
  ownership: {
    holdersCount: 689_000,
    top1HolderPct: 14.2,
    top5HolderPct: 38.5,
    top10HolderPct: 52.8,
    holderGrowthPct: 2.1,
    distribution: [
      { label: '>1%', count: 4, totalSharePct: 24.2 },
      { label: '0.1-1%', count: 85, totalSharePct: 28.6 },
      { label: '0.01-0.1%', count: 2800, totalSharePct: 22.4 },
      { label: '<0.01%', count: 686_111, totalSharePct: 24.8 },
    ],
    dataTimestamp: now,
    dataCompleteness: 0.95,
  },
  creator: {
    creatorAddress: 'BonkCreator9xK2xP5wN1a8BonkMain',
    creationTimestamp: '2022-12-25T00:00:00Z',
    creationTx: 'BonkGenesisTxHash123456',
    knownLaunches: 1,
    historyAvailable: true,
    dataTimestamp: now,
  },
  activity: {
    totalTransactions: 5350,
    uniqueWallets: 4200,
    repeatWalletRatio: 0.21,
    topWalletTxShare: 0.03,
    buysCount: 3200,
    sellsCount: 2150,
    avgTxSizeUsd: 3700,
    txSizeStdDev: 2800,
    volumeConcentration: 0.15,
    temporalClustering: 0.18,
    dataTimestamp: now,
  },
  contract: {
    tokenId: 'dt_bonk',
    chain: 'solana',
    name: 'Bonk Doge Token',
    symbol: 'BONK',
    mintAuthorityStatus: 'REVOKED',
    freezeAuthorityStatus: 'REVOKED',
    totalSupply: '93526183882122',
    circulatingSupply: '68245000000000',
    supplyChangeable: false,
    metadataUri: 'https://arweave.net/bonk-metadata',
    metadataChangeable: false,
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    isUpgradeable: false,
    dataTimestamp: now,
  },
  tokenSecurity: {
    tokenId: 'dt_bonk',
    chain: 'solana',
    dataTimestamp: now,
    security: { isToken2022: false, transferFeeEnable: false, nonTransferable: false, freezeable: false },
  },
  exitability: {
    liquidityUsd: 24_100_000,
    poolDepthUsd: 14_000_000,
    volume24hUsd: 19_800_000,
    volume1hUsd: 1_120_000,
    priceUsd: 0.00002845,
    feeTierPct: 0.25,
    dataTimestamp: now,
  },
};

// ── ALPHA: Explosive new launch, low liquidity ──
const ALPHA_INPUT: ReportInput = {
  token: MOCK_TOKENS.ALPHA,
  market: {
    priceUsd: 0.125,
    priceChange1h: 85.0,
    priceChange24h: 420.0,
    volume1hUsd: 950_000,
    volume24hUsd: 1_850_000,
    liquidityUsd: 45_000,
    marketCapUsd: 2_500_000,
    buysCount: 1850,
    sellsCount: 210,
    holdersCount: 3410,
    volatility24h: 65.0,
    averageTradeSizeUsd: 460,
    buySellRatio: 8.81,
    bidAskSpread: 3.5,
    dataTimestamp: now,
  },
  liquidity: {
    totalLiquidityUsd: 45_000,
    liquidityChange1hPct: 88.0,
    liquidityChange24hPct: 450.0,
    pools: [
      { id: 'ap1', dex: 'Orca', tvlUsd: 45_000, feeTier: 0.30, shareOfTotal: 1.0 },
    ],
    dataTimestamp: now,
  },
  ownership: {
    holdersCount: 3410,
    top1HolderPct: 32.5,
    top5HolderPct: 68.2,
    top10HolderPct: 82.1,
    holderGrowthPct: 140.0,
    distribution: [
      { label: '>1%', count: 8, totalSharePct: 52.5 },
      { label: '0.1-1%', count: 65, totalSharePct: 29.6 },
      { label: '<0.1%', count: 3337, totalSharePct: 17.9 },
    ],
    dataTimestamp: now,
    dataCompleteness: 0.68,
  },
  // Creator: partially known
  creator: {
    creatorAddress: 'AlphaCreator1aM3z9K2xP5wN1a84',
    creationTimestamp: now,
    knownLaunches: 8,
    historyAvailable: false,
    dataTimestamp: now,
  },
  activity: {
    totalTransactions: 2060,
    uniqueWallets: 380,
    repeatWalletRatio: 0.72,
    topWalletTxShare: 0.18,
    buysCount: 1850,
    sellsCount: 210,
    avgTxSizeUsd: 460,
    txSizeStdDev: 320,
    volumeConcentration: 0.65,
    temporalClustering: 0.78,
    dataTimestamp: now,
  },
  contract: {
    tokenId: 'dt_alpha',
    chain: 'solana',
    name: 'Alpha Matrix AI',
    symbol: 'ALPHA',
    mintAuthorityStatus: 'ACTIVE',
    mintAuthorityAddress: 'AlphaMintAuth1aM3z9K2xP5wN1a84',
    freezeAuthorityStatus: 'UNKNOWN',
    totalSupply: '20000000',
    supplyChangeable: true,
    metadataChangeable: true,
    programId: 'AlphaProgram1aM3z9K2xP5wN1a84',
    isUpgradeable: true,
    dataTimestamp: now,
  },
  tokenSecurity: {
    tokenId: 'dt_alpha',
    chain: 'solana',
    dataTimestamp: now,
    // ALPHA is already this mock set's "risky" token (worst creator reputation, highest
    // concentration) — a live Token-2022 transfer fee is a consistent, real-feeling flag
    // for it, and demonstrates the CONTRACT score actually moving for a risky token.
    security: { isToken2022: true, transferFeeEnable: true, nonTransferable: false, freezeable: false },
  },
  exitability: {
    liquidityUsd: 45_000,
    poolDepthUsd: 45_000,
    volume24hUsd: 1_850_000,
    volume1hUsd: 950_000,
    priceUsd: 0.125,
    feeTierPct: 0.30,
    dataTimestamp: now,
  },
};
