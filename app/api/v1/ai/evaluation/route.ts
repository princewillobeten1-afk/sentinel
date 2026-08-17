import { jsonResponse, errorResponse } from '@/lib/server/api';
import { EvaluationEngine } from '@/lib/ai/evaluation-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { preferredProvider } = body;

    const runMetrics = await EvaluationEngine.runEvaluationSuite({ preferredProvider });

    return jsonResponse({
      type: 'evaluation_run_results',
      metrics: runMetrics,
      goldenCasesCount: EvaluationEngine.getGoldenCases().length,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
