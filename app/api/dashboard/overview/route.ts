export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/dashboard/overview';
const NOTE =
  'This route returned four fixed strings unrelated to any real data.';

export async function GET() {
  return retiredRoute(REPLACEMENT, NOTE);
}
