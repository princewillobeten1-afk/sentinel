export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// Mock data representing the smart wallets leaderboard
const SMART_WALLETS = [
  {
    id: 'w_1',
    address: '0x8f2d...4a9e',
    scoreOverall: 94,
    scoreConsistency: 92,
    scoreRisk: 40,
    winRate: 68.4,
    totalRealizedPnl: 184500,
    tradeCount: 245,
    styleClassification: 'Momentum Scalper',
    confidenceLevel: 'HIGH',
    lastAnalyzedAt: new Date().toISOString()
  },
  {
    id: 'w_2',
    address: '0x33b1...7f2c',
    scoreOverall: 88,
    scoreConsistency: 76,
    scoreRisk: 75,
    winRate: 42.1,
    totalRealizedPnl: 420800,
    tradeCount: 88,
    styleClassification: 'Early Buyer',
    confidenceLevel: 'MEDIUM',
    lastAnalyzedAt: new Date().toISOString()
  },
  {
    id: 'w_3',
    address: '0xaa44...bb99',
    scoreOverall: 72,
    scoreConsistency: 88,
    scoreRisk: 25,
    winRate: 85.0,
    totalRealizedPnl: 42000,
    tradeCount: 420,
    styleClassification: 'Liquidity Arbitrage',
    confidenceLevel: 'HIGH',
    lastAnalyzedAt: new Date().toISOString()
  }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'scoreOverall';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Simple mock sorting
    const sorted = [...SMART_WALLETS].sort((a, b) => {
      if (sortBy === 'totalRealizedPnl') return b.totalRealizedPnl - a.totalRealizedPnl;
      if (sortBy === 'winRate') return b.winRate - a.winRate;
      return b.scoreOverall - a.scoreOverall; // default
    });

    return NextResponse.json({
      success: true,
      data: sorted.slice(0, limit)
    });
  } catch (error) {
    console.error('Smart Wallets Fetch Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
