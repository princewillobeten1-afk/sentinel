import { jsonResponse } from '@/lib/server/api';
import { getMockMarketSnapshots } from '@/lib/market/snapshot-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshots = getMockMarketSnapshots();
  return jsonResponse({
    snapshots,
    count: snapshots.length,
    timestamp: new Date().toISOString(),
  });
}
