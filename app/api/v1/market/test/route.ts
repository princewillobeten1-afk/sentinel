import { jsonResponse, errorResponse } from '@/lib/server/api';
import { runMarketSnapshotTestSuite } from '@/lib/testing/market-snapshot.test';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await runMarketSnapshotTestSuite();
    return jsonResponse({
      status: 'success',
      message: 'Market Snapshot & Financial Math Test Suite executed successfully.',
      summary,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new Error('Test execution failed'));
  }
}
