export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/alerts';
const NOTE =
  'The v1 feed is per-user and authenticated; this route returned one hardcoded alert to every caller.';

export async function GET() {
  return retiredRoute(REPLACEMENT, NOTE);
}

export async function POST() {
  return retiredRoute(REPLACEMENT, NOTE);
}
