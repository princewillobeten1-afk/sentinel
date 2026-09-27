import { errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
export async function POST() {
  return errorResponse(new ApiError('This demonstration endpoint has been retired. Use the exact-mint Intelligence report for measured evidence.', 410, 'DEMO_ENDPOINT_RETIRED'));
}
