import { jsonResponse } from '@/lib/server/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  return jsonResponse({
    schemaVersion: '2', engine: 'Sentinel Intelligence', methodologyVersion: 'observed-evidence-v1',
    supportedChains: ['solana'], identifier: 'Exact case-sensitive mint address',
    availableEndpoints: ['GET /api/v1/intelligence/candidates', 'GET /api/v1/intelligence/:chain/:mint',
      'GET /api/v1/intelligence/:chain/:mint/history', 'GET /api/v1/intelligence/:chain/:mint/signals'],
    capabilities: ['market observations', 'ownership evidence', 'authority checks', 'recorded creator counts', 'recorded observation history'],
    scoring: 'No aggregate safety or confidence score. Findings reference measured or explicitly stale evidence.',
    thresholds: { concentratedTop10Pct: 35, developerAllocationPct: 5, limitedLiquidityUsd: 10000 },
    disclaimer: 'Thresholds are review prompts, not calibrated probabilities or financial recommendations. Missing evidence never implies safety.'
  });
}
