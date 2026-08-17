export const dynamic = 'force-dynamic';

import { computePlatformSloOverview } from '@/lib/server/nfr/slo';
import { jsonResponse } from '@/lib/server/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const windowParam = url.searchParams.get('windowMs');
  const windowMs = windowParam ? Math.max(60_000, parseInt(windowParam, 10) || 3600_000) : 3600_000;

  const overview = computePlatformSloOverview(windowMs);
  return jsonResponse(overview);
}
