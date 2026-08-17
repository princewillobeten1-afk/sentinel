export const dynamic = 'force-dynamic';

import { evaluatePlatformQualityGates } from '@/lib/server/nfr/quality-gates';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const report = await evaluatePlatformQualityGates();
  const httpStatus = report.passedReleaseGate ? 200 : 503;
  return jsonResponse(report, httpStatus);
}
