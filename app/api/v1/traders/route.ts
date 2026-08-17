export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Stub for discovering and ranking traders
  const traders = [
    {
      id: '1',
      walletAddress: '2Kvw...9xab',
      classification: 'TRADER',
      confidence: 'HIGH',
      score: 92,
      riskLevel: 'Moderate',
      tradingStyle: 'Momentum / Meme',
      metrics: {
        netPnl: 284000,
        roi: 187,
        winRate: 68,
        maxDrawdown: 14,
        tradeCount: 412,
        avgHoldTime: '3h 12m'
      }
    },
    {
      id: '2',
      walletAddress: '8Frt...1yxc',
      classification: 'SWING_TRADER',
      confidence: 'MEDIUM',
      score: 85,
      riskLevel: 'Low',
      tradingStyle: 'Swing',
      metrics: {
        netPnl: 193000,
        roi: 61,
        winRate: 61,
        maxDrawdown: 9,
        tradeCount: 154,
        avgHoldTime: '4d 2h'
      }
    }
  ];

  return NextResponse.json(traders);
}
