import { jsonResponse } from '@/lib/server/api';
import { aiFeatureRegistry } from '@/lib/ai/feature-registry';
import { modelRouter } from '@/lib/ai/model-router';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonResponse({
    features: aiFeatureRegistry.getAllFeatures(),
    models: modelRouter.getAllModels(),
    timestamp: new Date().toISOString(),
  });
}
