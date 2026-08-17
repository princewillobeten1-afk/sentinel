import { NextResponse } from 'next/server';
import { DataQualityEngine } from '@/lib/analytics';

export async function GET() {
  const now = Date.now();
  const report = DataQualityEngine.auditProviders({
    quotes: [
      {
        providerName: 'Helius Geyser WS',
        priceUsd: 148.52,
        poolLiquidityUsd: 4_200_000,
        timestampMs: now - 80,
      },
      {
        providerName: 'Birdeye Price Stream',
        priceUsd: 148.56,
        poolLiquidityUsd: 4_190_000,
        timestampMs: now - 150,
      },
      {
        providerName: 'QuickNode RPC Cluster',
        priceUsd: 148.49,
        poolLiquidityUsd: 4_210_000,
        timestampMs: now - 220,
      },
    ],
    indexerLagMs: 280,
  });

  return NextResponse.json({
    dataQualityReport: report,
    timestamp: new Date().toISOString(),
  });
}
