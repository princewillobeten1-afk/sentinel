import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    subsystem: 'Measured analytics',
    principles: [
      'Raw Data -> Metrics -> Signals -> Scores -> Insights',
      'Unavailable evidence is not represented as a measured value',
      'Historical signals execute on the next closed candle open',
    ],
    endpoints: {
      market: '/api/v1/analytics/market',
      research: '/api/v1/analytics/research',
      token: '/api/v1/analytics/token/[tokenAddress]',
      walletActivity: '/api/v1/analytics/wallet/[walletAddress]',
      personalOrders: '/api/v1/trading/history',
      backtest: '/api/v1/analytics/backtest',
      capabilityHealth: '/api/v1/analytics/quality',
    },
  });
}
