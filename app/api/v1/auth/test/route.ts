import { jsonResponse, errorResponse } from '@/lib/server/api';
import { runSprint2TestSuite } from '@/lib/testing/sprint2.test';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await runSprint2TestSuite();
    return jsonResponse({
      status: 'success',
      message: 'Sprint 2 Automated Test Suite executed successfully.',
      summary,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error('Test execution failed'));
  }
}
