import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

const mockAiMonitoring = {
  requests24h: 1248920,
  uniqueUsers24h: 18420,
  avgLatencyMs: 142,
  p99LatencyMs: 410,
  totalCostUsd: 342.1,
  costPerRequestUsd: 0.00027,
  cacheHitRatePct: 68.4,
  fallbackRatePct: 0.12,
  qualityMetrics: {
    groundingScorePct: 98.7,
    hallucinationRatePct: 0.04,
    lowConfidenceRatePct: 0.82,
    userSatisfactionRatePct: 96.8,
  },
  modelRouting: {
    activePrimaryModel: 'gemini-3.7-flash',
    activeFallbackModel: 'gemini-3.5-flash',
    maxTokenLimit: 4096,
    rateLimitRpm: 1200,
    groundingStrictness: 'STANDARD',
  },
  recentHallucinationIncidents: [
    {
      id: 'ai_inc_01',
      tokenSymbol: '$SOLM',
      prompt: 'Is $SOLM liquidity locked on Raydium?',
      flaggedResponse: 'Claimed liquidity was locked for 1 year when contract had unlocked LP.',
      detectedAt: '2h ago',
      remediated: true,
    },
  ],
};

/** GET /api/v1/admin/ai-monitoring — AI operational telemetry, costs, grounding quality. */
export async function GET() {
  try {
    return jsonResponse(mockAiMonitoring);
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to load AI monitoring telemetry', 500));
  }
}
