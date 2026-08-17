export const dynamic = 'force-dynamic';

import { checkLiveness } from '@/lib/server/nfr/health';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const liveness = await checkLiveness();
  return jsonResponse(
    {
      status: liveness.alive ? 'alive' : 'dead',
      ...liveness,
      timestamp: new Date().toISOString(),
    },
    liveness.alive ? 200 : 503
  );
}
