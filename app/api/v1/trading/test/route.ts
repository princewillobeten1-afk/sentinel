import { jsonResponse, errorResponse } from '@/lib/server/api';
import { runSprint3TestSuite } from '@/lib/testing/sprint3.test';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await runSprint3TestSuite();
    return jsonResponse({
      status: 'success',
      message: 'Sprint 3 Automated Test Suite executed successfully.',
      summary,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error('Sprint 3 test execution failed'));
  }
}
