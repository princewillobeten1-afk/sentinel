/**
 * Activity Engine Mocks — Sprint 7
 *
 * Provides realistic mock trade sequences, funding events, cluster mappings,
 * and historical launcher records for SENT, QUANT, BONK, and ALPHA.
 */

import type {
  ActivityContext,
  HistoricalWalletPattern,
  NormalizedTrade,
  WalletFundingEvent,
} from '@/lib/activity/types';
import type { WalletClusterV2, WalletRelationshipEdge } from '@/lib/ownership/types';

const NOW = new Date().toISOString();
const LAUNCH_TIME = new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(); // 3 days ago

// Helper generator for timestamps
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function secondsAfterLaunch(seconds: number): string {
  return new Date(new Date(LAUNCH_TIME).getTime() + seconds * 1000).toISOString();
}

// ── 1. SENT Mock Activity Data (Broad & Organic) ──
export function getSentActivityData(): {
  trades: NormalizedTrade[];
  context: ActivityContext;
} {
  const creator = 'Crtr5xK99zK8mP2xQ5wN3a19SentCreator';
  const context: ActivityContext = {
    tokenId: 'dt_sentinel',
    chain: 'solana',
    tokenCreatedAt: LAUNCH_TIME,
    firstLiquidityAt: LAUNCH_TIME,
    tradingOpenedAt: LAUNCH_TIME,
    observedAt: NOW,
    dataCompleteFrom: LAUNCH_TIME,
    dataCompleteTo: NOW,
    creatorWallets: [creator],
    clusters: [],
    relationships: [],
    fundingEvents: [],
    historicalPatterns: [],
  };

  const trades: NormalizedTrade[] = [];
  const baseWallets = Array.from({ length: 120 }, (_, i) => `5SentWallet_${i + 1}_BroadTraderPK`);

  // Generate 250 diverse trades spread across 120 wallets
  for (let i = 0; i < 250; i++) {
    const wallet = baseWallets[i % baseWallets.length];
    const isBuy = (i * 7) % 10 < 6;
    const amountUsd = Math.round(50 + ((i * 13) % 450) + Math.random() * 20);

    trades.push({
      id: `tr_sent_${i + 1}`,
      tokenId: 'dt_sentinel',
      chain: 'solana',
      wallet,
      side: isBuy ? 'BUY' : 'SELL',
      amountUsd,
      timestamp: minutesAgo(240 - i * 0.9),
      txHash: `5SentTx_${i + 1}_HashSign`,
    });
  }

  return { trades, context };
}

// ── 2. QUANT Mock Activity Data (Bot-heavy & Concentrated) ──
export function getQuantActivityData(): {
  trades: NormalizedTrade[];
  context: ActivityContext;
} {
  const creator = 'Crtr3mR8z9K2xP5wN1a84QuantCreator';
  const clusterId = 'cluster_quant_bots_99';
  const botWallets = [
    '5QuantBot_1_PK8x9a109',
    '5QuantBot_2_PK8x9a110',
    '5QuantBot_3_PK8x9a111',
    '5QuantBot_4_PK8x9a112',
    '5QuantBot_5_PK8x9a113',
  ];

  const clusters: WalletClusterV2[] = [
    {
      id: clusterId,
      scope: 'TOKEN_SPECIFIC',
      tokenContext: 'dt_quantum',
      wallets: botWallets,
      edges: [],
      clusterConfidence: {
        score: 0.92,
        evidenceCount: 1,
        strongestEvidence: {
          fact: 'High frequency execution pattern',
          source: 'activity_analysis',
          observedAt: LAUNCH_TIME,
          confidence: 0.92,
        },
        conflictingEvidence: [],
        methodologyVersion: 'wallet-clustering-v1.0',
      },
      label: 'High-Frequency Bot Cluster',
      methodologyVersion: 'v1',
      createdAt: LAUNCH_TIME,
    },
  ];

  const context: ActivityContext = {
    tokenId: 'dt_quantum',
    chain: 'solana',
    tokenCreatedAt: LAUNCH_TIME,
    firstLiquidityAt: LAUNCH_TIME,
    tradingOpenedAt: LAUNCH_TIME,
    observedAt: NOW,
    dataCompleteFrom: LAUNCH_TIME,
    dataCompleteTo: NOW,
    creatorWallets: [creator],
    clusters,
    relationships: [],
    fundingEvents: [],
    historicalPatterns: [],
  };

  const trades: NormalizedTrade[] = [];

  // Generate bot trades with repeated sizes ($500 fixed) at regular intervals
  for (let i = 0; i < 180; i++) {
    const wallet = botWallets[i % botWallets.length];
    const isBuy = (i * 3) % 5 !== 0;

    trades.push({
      id: `tr_quant_${i + 1}`,
      tokenId: 'dt_quantum',
      chain: 'solana',
      wallet,
      side: isBuy ? 'BUY' : 'SELL',
      amountUsd: 500, // Exactly repeated size
      timestamp: minutesAgo(180 - i * 0.95), // Fixed interval
      txHash: `5QuantTx_${i + 1}_HashSign`,
      clusterId,
    });
  }

  return { trades, context };
}

// ── 3. BONK Mock Activity Data (Established Market Maker & High Volume) ──
export function getBonkActivityData(): {
  trades: NormalizedTrade[];
  context: ActivityContext;
} {
  const mmWallet = '5BonkMarketMaker_99X_PK';
  const context: ActivityContext = {
    tokenId: 'dt_bonk',
    chain: 'solana',
    tokenCreatedAt: LAUNCH_TIME,
    firstLiquidityAt: LAUNCH_TIME,
    tradingOpenedAt: LAUNCH_TIME,
    observedAt: NOW,
    dataCompleteFrom: LAUNCH_TIME,
    dataCompleteTo: NOW,
    creatorWallets: [],
    clusters: [],
    relationships: [],
    fundingEvents: [],
    historicalPatterns: [],
  };

  const trades: NormalizedTrade[] = [];
  const activeWallets = Array.from({ length: 80 }, (_, i) => `5BonkTrader_${i + 1}_PK`);

  // Generate 200 trades including balanced two-sided market-making trades
  for (let i = 0; i < 200; i++) {
    const isMM = i % 2 === 0;
    const wallet = isMM ? mmWallet : activeWallets[i % activeWallets.length];
    const side = isMM ? (i % 4 === 0 ? 'BUY' : 'SELL') : i % 3 === 0 ? 'SELL' : 'BUY';

    trades.push({
      id: `tr_bonk_${i + 1}`,
      tokenId: 'dt_bonk',
      chain: 'solana',
      wallet,
      side,
      amountUsd: isMM ? 12_500 : Math.round(200 + Math.random() * 1500),
      timestamp: minutesAgo(200 - i),
      txHash: `5BonkTx_${i + 1}_HashSign`,
    });
  }

  return { trades, context };
}

// ── 4. ALPHA Mock Activity Data (Early Coordinated & Pre-funded Cluster) ──
export function getAlphaActivityData(): {
  trades: NormalizedTrade[];
  context: ActivityContext;
  currentPositionsUsd: Record<string, number>;
  realizedPnlUsd: Record<string, number>;
  unrealizedPnlUsd: Record<string, number>;
} {
  const creator = 'Crtr1aM3z9AlphaCreatorAddressPK';
  const funder = '5AlphaFundingSourceWalletPK';
  const candidateGroup = [
    '5AlphaEarlyBuyer_1_PK',
    '5AlphaEarlyBuyer_2_PK',
    '5AlphaEarlyBuyer_3_PK',
    '5AlphaEarlyBuyer_4_PK',
  ];

  const clusterId = 'cluster_alpha_launch_insiders';

  const clusters: WalletClusterV2[] = [
    {
      id: clusterId,
      scope: 'TOKEN_SPECIFIC',
      tokenContext: 'dt_alpha',
      wallets: candidateGroup,
      edges: [],
      clusterConfidence: {
        score: 0.88,
        evidenceCount: 1,
        strongestEvidence: {
          fact: 'Shared funding before launch',
          source: 'funding_analysis',
          observedAt: LAUNCH_TIME,
          confidence: 0.88,
        },
        conflictingEvidence: [],
        methodologyVersion: 'wallet-clustering-v1.0',
      },
      label: 'Early Coordinated Launch Group',
      methodologyVersion: 'v1',
      createdAt: LAUNCH_TIME,
    },
  ];

  const fundingEvents: WalletFundingEvent[] = candidateGroup.map((wallet) => ({
    sourceWallet: funder,
    recipientWallet: wallet,
    amountUsd: 15_000,
    timestamp: new Date(new Date(LAUNCH_TIME).getTime() - 600 * 1000).toISOString(), // 10m before launch
    txHash: `5AlphaFundTx_${wallet}`,
    relationshipToCreator: true,
  }));

  const relationships: WalletRelationshipEdge[] = [
    {
      id: 'rel_alpha_1',
      source: candidateGroup[0],
      target: candidateGroup[1],
      type: 'COORDINATED_ACQUISITION',
      confidence: 0.86,
      strength: 0.82,
      firstObserved: secondsAfterLaunch(45),
      lastObserved: NOW,
      methodologyVersion: 'v1',
      evidence: [
        {
          fact: 'Wallets bought within 47 seconds of launch from shared funding source',
          source: 'launch_analysis',
          observedAt: secondsAfterLaunch(45),
          value: 47,
          confidence: 0.86,
        },
      ],
    },
    {
      id: 'rel_alpha_2',
      source: candidateGroup[2],
      target: candidateGroup[3],
      type: 'COORDINATED_DISPOSAL',
      confidence: 0.84,
      strength: 0.78,
      firstObserved: secondsAfterLaunch(1800),
      lastObserved: NOW,
      methodologyVersion: 'v1',
      evidence: [
        {
          fact: 'Wallets exited position simultaneously within 120 seconds window',
          source: 'exit_analysis',
          observedAt: secondsAfterLaunch(1800),
          value: 120,
          confidence: 0.84,
        },
      ],
    },
  ];

  const historicalPatterns: HistoricalWalletPattern[] = candidateGroup.map((wallet) => ({
    wallet,
    earlyEntries: 4,
    profitableEarlyExits: 3,
    observedLaunches: 4,
    averageReturnPct: 340,
    evidence: [
      {
        fact: `Wallet ${wallet} entered early in 4 previous token launches`,
        source: 'historical_behavior',
        observedAt: NOW,
        value: 4,
        confidence: 0.82,
      },
    ],
  }));

  const context: ActivityContext = {
    tokenId: 'dt_alpha',
    chain: 'solana',
    tokenCreatedAt: LAUNCH_TIME,
    firstLiquidityAt: LAUNCH_TIME,
    tradingOpenedAt: LAUNCH_TIME,
    observedAt: NOW,
    dataCompleteFrom: LAUNCH_TIME,
    dataCompleteTo: NOW,
    creatorWallets: [creator, funder],
    clusters,
    relationships,
    fundingEvents,
    historicalPatterns,
  };

  const trades: NormalizedTrade[] = [];

  // Coordinated early entries within 45 seconds of launch
  candidateGroup.forEach((wallet, index) => {
    trades.push({
      id: `tr_alpha_early_${index + 1}`,
      tokenId: 'dt_alpha',
      chain: 'solana',
      wallet,
      side: 'BUY',
      amountUsd: 25_000,
      timestamp: secondsAfterLaunch(15 + index * 8), // 15s, 23s, 31s, 39s
      txHash: `5AlphaTx_Early_${index + 1}`,
      clusterId,
      fundingSource: funder,
      creatorAssociated: true,
      supplyPct: 0.012, // 1.2% supply each
      liquidityPct: 0.08,
    });
  });

  // Circular trading pairs A <-> B
  for (let i = 0; i < 6; i++) {
    trades.push({
      id: `tr_alpha_circ_${i + 1}`,
      tokenId: 'dt_alpha',
      chain: 'solana',
      wallet: candidateGroup[i % 2],
      counterparty: candidateGroup[(i + 1) % 2],
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      amountUsd: 10_000,
      timestamp: minutesAgo(120 - i * 15),
      txHash: `5AlphaTx_Circ_${i + 1}`,
      clusterId,
    });
  }

  // Coordinated exit sales
  candidateGroup.forEach((wallet, index) => {
    trades.push({
      id: `tr_alpha_exit_${index + 1}`,
      tokenId: 'dt_alpha',
      chain: 'solana',
      wallet,
      side: 'SELL',
      amountUsd: 45_000,
      timestamp: minutesAgo(30 + index * 0.5), // Sold within 2 min window
      txHash: `5AlphaTx_Exit_${index + 1}`,
      clusterId,
    });
  });

  const currentPositionsUsd: Record<string, number> = {};
  const realizedPnlUsd: Record<string, number> = {};
  const unrealizedPnlUsd: Record<string, number> = {};

  candidateGroup.forEach((wallet) => {
    currentPositionsUsd[wallet] = 5_000;
    realizedPnlUsd[wallet] = 20_000;
    unrealizedPnlUsd[wallet] = 3_500;
  });

  return {
    trades,
    context,
    currentPositionsUsd,
    realizedPnlUsd,
    unrealizedPnlUsd,
  };
}
