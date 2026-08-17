export const dynamic = 'force-dynamic';

import { getDetailedHealthReport } from '@/lib/server/nfr/health';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const report = await getDetailedHealthReport();
  const httpStatus = report.status === 'unhealthy' ? 503 : 200;
  return jsonResponse(report, httpStatus);
}
