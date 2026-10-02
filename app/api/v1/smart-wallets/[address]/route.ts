export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export interface WalletPositionItem {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo?: string;
  dexBadge?: 'pump' | 'raydium' | 'meteora' | string;
  boughtUsd: number;
  boughtTokens: string;
  soldUsd: number;
  soldTokens: string;
  remainingUsd: number;
  remainingTokens: string;
  pnlUsd: number;
  pnlPercent: number;
  isWin: boolean;
  openedAge: string;
  lastTxAge: string;
  txHash: string;
}

export interface WalletTradeRecord {
  id: string;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo?: string;
  action: 'BUY' | 'SELL';
  entryPriceUsd: number;
  exitPriceUsd: number;
  amountSol: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPercent: number;
  isWin: boolean;
  holdingDuration: string;
  timestamp: string;
  txHash: string;
}

export interface EquityCurvePoint {
  date: string;
  timestamp: number;
  cumulativePnlUsd: number;
  tradePnlUsd: number;
  isWin: boolean;
  tokenSymbol: string;
  roiPct: number;
}

export interface ActivityHeatmapDay {
  dayLabel: 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S';
  dayIndex: number;
  hours: { hour: number; count: number; pnl: number }[];
}

export interface WalletPerformanceDetail {
  address: string;
  fullAddress: string;
  label: string;
  category: string;
  followersCount: string;
  scoreOverall: number;
  winRate: number;
  totalRealizedPnl: number;
  pnl7d: number;
  pnl30d: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  profitFactor: number;
  avgWinUsd: number;
  avgLossUsd: number;
  avgHoldTime: string;

  // Axiom 3-column stats
  balance: {
    totalValueUsd: number;
    unrealizedPnlUsd: number;
    tradeableSol: number;
    walletFundingSol: number;
    walletFundingAge: string;
    stableCoinBalanceUsd: number;
  };
  activityHeatmap: ActivityHeatmapDay[];
  performance: {
    totalPnlUsd: number;
    realizedPnlUsd: number;
    totalTxns: number;
    winsCount: number;
    lossCount: number;
    sharpeRatio: number;
    roiBuckets: {
      gt500: number;
      from200to500: number;
      from0to200: number;
      from0toNeg50: number;
      ltNeg50: number;
    };
  };

  bestTrade: {
    symbol: string;
    pnlUsd: number;
    roiPct: number;
  };
  worstTrade: {
    symbol: string;
    pnlUsd: number;
    roiPct: number;
  };
  styleClassification: string;
  
  // Charts & Tables
  equityCurve: EquityCurvePoint[];
  timeframeCurves: {
    '1d': EquityCurvePoint[];
    '7d': EquityCurvePoint[];
    '30d': EquityCurvePoint[];
    Max: EquityCurvePoint[];
  };
  activePositions: WalletPositionItem[];
  historyPositions: WalletPositionItem[];
  trades: WalletTradeRecord[];
}

// Sample token pool for generating realistic positions
const SAMPLE_TOKENS = [
  { symbol: 'pad', name: 'Launchpad Alpha', mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump', dexBadge: 'pump', logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop', price: 0.0024 },
  { symbol: 'DNUT', name: 'donut fa...', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', dexBadge: 'pump', logo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=80&h=80&fit=crop', price: 0.00081 },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', dexBadge: 'raydium', logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I', price: 0.0000248 },
  { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', dexBadge: 'raydium', logo: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link', price: 2.14 },
  { symbol: 'POPCAT', name: 'Popcat', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', dexBadge: 'raydium', logo: 'https://bafkreidvkvuzw64e262j6u45e6m32h24i4sqquu65t4v4kexnfdx5u2p47m53m.ipfs.nftstorage.link', price: 1.28 },
  { symbol: 'MEW', name: 'cat in a dogs world', mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', dexBadge: 'meteora', logo: 'https://bafybeicg5z3oxcbgq32h72xey4i5qquu65t4v4kexnfdx5u2p47m53m5re.ipfs.nftstorage.link', price: 0.0054 },
  { symbol: 'SENT', name: 'Project Sentinel', mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump', dexBadge: 'pump', logo: '/icons/sentinel.png', price: 0.042 },
  { symbol: 'FART', name: 'Fartcoin', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', dexBadge: 'pump', logo: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=80&h=80&fit=crop', price: 0.38 },
];

function pseudoHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function GET(
  _request: Request,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address;
    if (!address) {
      return NextResponse.json({ success: false, error: 'Address required' }, { status: 400 });
    }

    const seed = pseudoHash(address);
    const winRate = Math.min(94, Math.max(58, 64 + (seed % 28)));
    const totalTrades = Math.max(85, (seed % 450) + 140);
    const totalWins = Math.round((totalTrades * winRate) / 100);
    const totalLosses = totalTrades - totalWins;

    const baseProfit = Math.max(45000, ((seed % 900) + 120) * 1000);
    const pnl7d = Math.round(baseProfit * (0.15 + (seed % 10) / 100));
    const pnl30d = Math.round(baseProfit * (0.5 + (seed % 15) / 100));

    const avgWin = Math.round((baseProfit * 1.6) / totalWins);
    const avgLoss = Math.round((baseProfit * 0.5) / Math.max(1, totalLosses));
    const profitFactor = Math.round(((totalWins * avgWin) / Math.max(1, totalLosses * avgLoss)) * 10) / 10;

    // ROI Buckets (Axiom style)
    const gt500 = Math.max(1, Math.round(totalWins * 0.03));
    const from200to500 = Math.round(totalWins * 0.12);
    const from0to200 = totalWins - gt500 - from200to500;
    const from0toNeg50 = Math.round(totalLosses * 0.78);
    const ltNeg50 = totalLosses - from0toNeg50;

    // Build Activity Heatmap (7 days x 24 hours)
    const days: ('M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S')[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const activityHeatmap: ActivityHeatmapDay[] = days.map((dayLabel, dayIndex) => {
      const hours = Array.from({ length: 24 }).map((_, hour) => {
        const cellSeed = seed + dayIndex * 24 + hour;
        // Peak hours in trading (12p to 10p)
        const isPeak = hour >= 12 && hour <= 22;
        const count = isPeak && cellSeed % 3 === 0 ? (cellSeed % 5) + 1 : cellSeed % 7 === 0 ? 1 : 0;
        const isProfit = cellSeed % 2 === 0;
        const pnl = count > 0 ? (isProfit ? 1 : -1) * ((cellSeed % 300) + 50) : 0;
        return { hour, count, pnl };
      });
      return { dayLabel, dayIndex, hours };
    });

    // Generate trade history log & multi-timeframe equity curves
    const trades: WalletTradeRecord[] = [];
    const now = Date.now();
    const allCurvePoints: EquityCurvePoint[] = [];
    let runningCumulativePnl = 0;

    const tradesCount = Math.min(45, totalTrades);
    for (let i = tradesCount - 1; i >= 0; i--) {
      const tradeSeed = seed + i * 37;
      const isWin = (tradeSeed % 100) < winRate;
      const token = SAMPLE_TOKENS[tradeSeed % SAMPLE_TOKENS.length];
      
      const roiPct = isWin
        ? Math.round((20 + (tradeSeed % 350)) * 10) / 10
        : -Math.round((5 + (tradeSeed % 60)) * 10) / 10;

      const amountSol = Math.round((1.5 + (tradeSeed % 30)) * 10) / 10;
      const valueUsd = Math.round(amountSol * 152);
      const pnlUsd = Math.round((valueUsd * roiPct) / 100);

      runningCumulativePnl += pnlUsd;

      const tradeTime = now - i * (86400000 * 30 / tradesCount) - (tradeSeed % 3600000);
      const isoTime = new Date(tradeTime).toISOString();

      const durationMinutes = (tradeSeed % 120) + 10;
      const holdingDuration = durationMinutes > 60 
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` 
        : `${durationMinutes}m`;

      const record: WalletTradeRecord = {
        id: `tr_${address.slice(0, 4)}_${i}`,
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        tokenLogo: token.logo,
        action: 'SELL',
        entryPriceUsd: token.price * (isWin ? 0.75 : 1.2),
        exitPriceUsd: token.price,
        amountSol,
        valueUsd,
        pnlUsd,
        pnlPercent: roiPct,
        isWin,
        holdingDuration,
        timestamp: isoTime,
        txHash: `${address.slice(0, 6)}...${tradeSeed.toString(16).slice(0, 4)}`,
      };

      trades.unshift(record);

      allCurvePoints.push({
        date: new Date(tradeTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: tradeTime,
        cumulativePnlUsd: runningCumulativePnl,
        tradePnlUsd: pnlUsd,
        isWin,
        tokenSymbol: token.symbol,
        roiPct,
      });
    }

    // Timeframe curves
    const curve1d = allCurvePoints.slice(-Math.min(allCurvePoints.length, 8));
    const curve7d = allCurvePoints.slice(-Math.min(allCurvePoints.length, 18));
    const curve30d = allCurvePoints.slice(-Math.min(allCurvePoints.length, 30));
    const curveMax = allCurvePoints;

    // Generate Active Positions (tokens they currently hold)
    const activePositions: WalletPositionItem[] = [
      {
        id: 'pos_1',
        tokenMint: SAMPLE_TOKENS[0].mint,
        tokenSymbol: SAMPLE_TOKENS[0].symbol,
        tokenName: SAMPLE_ENS_NAME(SAMPLE_TOKENS[0].name),
        tokenLogo: SAMPLE_TOKENS[0].logo,
        dexBadge: SAMPLE_TOKENS[0].dexBadge,
        boughtUsd: 10.95,
        boughtTokens: '208K pad',
        soldUsd: 0,
        soldTokens: '0 pad',
        remainingUsd: 0.509,
        remainingTokens: '208K pad',
        pnlUsd: -10.44,
        pnlPercent: -95.35,
        isWin: false,
        openedAge: '11h ago',
        lastTxAge: 'last TX 11h ago',
        txHash: '5x9Yv...4r12',
      },
      {
        id: 'pos_2',
        tokenMint: SAMPLE_TOKENS[1].mint,
        tokenSymbol: SAMPLE_TOKENS[1].symbol,
        tokenName: SAMPLE_TOKENS[1].name,
        tokenLogo: SAMPLE_TOKENS[1].logo,
        dexBadge: SAMPLE_TOKENS[1].dexBadge,
        boughtUsd: 2.056,
        boughtTokens: '2.53K DNUT',
        soldUsd: 0,
        soldTokens: '0 DNUT',
        remainingUsd: 0.025,
        remainingTokens: '2.53K DNUT',
        pnlUsd: -2.051,
        pnlPercent: -99.74,
        isWin: false,
        openedAge: '13d ago',
        lastTxAge: 'last TX 13d ago',
        txHash: '3mK8s...9t44',
      },
      {
        id: 'pos_3',
        tokenMint: SAMPLE_TOKENS[6].mint,
        tokenSymbol: SAMPLE_TOKENS[6].symbol,
        tokenName: SAMPLE_TOKENS[6].name,
        tokenLogo: SAMPLE_TOKENS[6].logo,
        dexBadge: SAMPLE_TOKENS[6].dexBadge,
        boughtUsd: 1420.5,
        boughtTokens: '34.5K SENT',
        soldUsd: 480.0,
        soldTokens: '10K SENT',
        remainingUsd: 1845.0,
        remainingTokens: '24.5K SENT',
        pnlUsd: 904.5,
        pnlPercent: 63.7,
        isWin: true,
        openedAge: '2d ago',
        lastTxAge: 'last TX 4h ago',
        txHash: '4nL7v...8x02',
      },
      {
        id: 'pos_4',
        tokenMint: SAMPLE_TOKENS[3].mint,
        tokenSymbol: SAMPLE_TOKENS[3].symbol,
        tokenName: SAMPLE_TOKENS[3].name,
        tokenLogo: SAMPLE_TOKENS[3].logo,
        dexBadge: SAMPLE_TOKENS[3].dexBadge,
        boughtUsd: 2500.0,
        boughtTokens: '1.2K WIF',
        soldUsd: 1800.0,
        soldTokens: '600 WIF',
        remainingUsd: 1284.0,
        remainingTokens: '600 WIF',
        pnlUsd: 584.0,
        pnlPercent: 23.3,
        isWin: true,
        openedAge: '5d ago',
        lastTxAge: 'last TX 1d ago',
        txHash: '2pK9v...1z90',
      },
    ];

    // Generate History Positions (closed trades)
    const historyPositions: WalletPositionItem[] = trades.slice(0, 15).map((t, idx) => ({
      id: `hist_${idx}`,
      tokenMint: t.tokenMint,
      tokenSymbol: t.tokenSymbol,
      tokenName: t.tokenName,
      tokenLogo: t.tokenLogo,
      dexBadge: 'raydium',
      boughtUsd: t.valueUsd,
      boughtTokens: `${(t.amountSol * 12).toFixed(1)}K ${t.tokenSymbol}`,
      soldUsd: t.valueUsd + t.pnlUsd,
      soldTokens: `${(t.amountSol * 12).toFixed(1)}K ${t.tokenSymbol}`,
      remainingUsd: 0,
      remainingTokens: `0 ${t.tokenSymbol}`,
      pnlUsd: t.pnlUsd,
      pnlPercent: t.pnlPercent,
      isWin: t.isWin,
      openedAge: t.holdingDuration,
      lastTxAge: new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      txHash: t.txHash,
    }));

    const detail: WalletPerformanceDetail = {
      address: `${address.slice(0, 4)}...${address.slice(-4)}`,
      fullAddress: address,
      label: `AlphaTrader (${address.slice(0, 6)})`,
      category: (seed % 4 === 0) ? 'WHALE' : (seed % 4 === 1) ? 'SMART_MONEY' : (seed % 4 === 2) ? 'KOL' : 'SNIPER',
      followersCount: `${((seed % 25) + 1).toFixed(1)}K`,
      scoreOverall: Math.min(99, Math.max(72, 82 + (seed % 17))),
      winRate,
      totalRealizedPnl: baseProfit,
      pnl7d,
      pnl30d,
      totalTrades,
      totalWins,
      totalLosses,
      profitFactor: Math.max(2.1, profitFactor),
      avgWinUsd: avgWin,
      avgLossUsd: avgLoss,
      avgHoldTime: (seed % 2 === 0) ? '32m' : '1h 15m',
      
      // 3-Column Axiom layout data
      balance: {
        totalValueUsd: 21.41 + (seed % 1500),
        unrealizedPnlUsd: 7.784 + (seed % 200),
        tradeableSol: Number(((seed % 12) * 0.1).toFixed(3)),
        walletFundingSol: 0.081,
        walletFundingAge: '13d',
        stableCoinBalanceUsd: 0.781,
      },
      activityHeatmap,
      performance: {
        totalPnlUsd: baseProfit,
        realizedPnlUsd: baseProfit,
        totalTxns: totalTrades,
        winsCount: totalWins,
        lossCount: totalLosses,
        sharpeRatio: Number((3.5 + (seed % 35) / 10).toFixed(2)),
        roiBuckets: {
          gt500,
          from200to500,
          from0to200,
          from0toNeg50,
          ltNeg50,
        },
      },

      bestTrade: {
        symbol: 'BONK',
        pnlUsd: Math.round(baseProfit * 0.32),
        roiPct: 840,
      },
      worstTrade: {
        symbol: 'pad',
        pnlUsd: -10.44,
        roiPct: -95.35,
      },
      styleClassification: (seed % 3 === 0) ? 'Momentum Scalper' : (seed % 3 === 1) ? 'High-Conviction Swing' : 'Trench Sniper',
      
      equityCurve: allCurvePoints,
      timeframeCurves: {
        '1d': curve1d,
        '7d': curve7d,
        '30d': curve30d,
        Max: curveMax,
      },
      activePositions,
      historyPositions,
      trades,
    };

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch wallet detail' },
      { status: 500 }
    );
  }
}

function SAMPLE_ENS_NAME(name: string): string {
  return name.length > 12 ? name.slice(0, 10) + '...' : name;
}
