import { jsonResponse, errorResponse } from '@/lib/server/api';
import { runSprint4TestSuite } from '@/lib/testing/sprint4.test';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await runSprint4TestSuite();
    return jsonResponse({
      sprint: 'Sprint 4 — Token Discovery Engine',
      summary,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error('Sprint 4 test suite execution failed'));
  }
}
