import { jsonResponse } from '@/lib/server/api';
import { aiFeatureRegistry } from '@/lib/ai/feature-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonResponse({
    engine: 'Sentinel AI Intelligence Layer & Gateway v2.4',
    status: 'operational',
    safetyPrinciples: [
      'AI never invents blockchain facts',
      'AI never controls private keys or executes trades autonomously',
      'AI never overrides risk controls',
      'AI never claims certainty about future prices',
      'All AI claims are evidence-grounded and validated',
    ],
    availableEndpoints: [
      'POST /api/v1/ai/analyze',
      'POST /api/v1/ai/copilot',
      'POST /api/v1/ai/what-changed',
      'POST /api/v1/ai/trade-check',
      'GET  /api/v1/ai/features',
      'POST /api/v1/ai/evaluation',
    ],
    registeredFeatures: aiFeatureRegistry.getAllFeatures().map((f) => ({
      featureId: f.featureId,
      name: f.name,
      modelCategory: f.modelCategory,
      maxLatencyMs: f.maxLatencyMs,
      enabled: f.enabled,
    })),
  });
}
