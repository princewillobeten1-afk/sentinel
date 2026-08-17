export const dynamic = 'force-dynamic';

import { checkReadiness } from '@/lib/server/nfr/health';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const readiness = await checkReadiness();
  const httpStatus = readiness.ready ? 200 : 503;
  return jsonResponse(
    {
      status: readiness.ready ? 'ready' : 'not_ready',
      ...readiness,
      timestamp: new Date().toISOString(),
    },
    httpStatus
  );
}
