import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: '1.0.0',
    subsystem: 'Sprint 38 — Analytics & Data Intelligence Platform',
    principles: [
      'Raw Data -> Metrics -> Signals -> Scores -> Insights',
      'Bidirectional lineage traceability to raw Solana slot',
      'Strict Zero Look-Ahead historical backtesting',
      'Multi-provider data validation and discrepancy auditing',
    ],
    endpoints: {
      market: '/api/v1/analytics/market',
      token: '/api/v1/analytics/token/[tokenAddress]',
      wallet: '/api/v1/analytics/wallet/[walletAddress]',
      creator: '/api/v1/analytics/creator/[creatorAddress]',
      trader: '/api/v1/analytics/trader',
      backtest: '/api/v1/analytics/backtest',
      quality: '/api/v1/analytics/quality',
    },
  });
}
