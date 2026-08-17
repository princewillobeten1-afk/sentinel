export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/orders';
const NOTE =
  'Wrote to a module-scope array with no auth, no persistence and float money.';

export async function GET() {
  return retiredRoute(REPLACEMENT, NOTE);
}

export async function POST() {
  return retiredRoute(REPLACEMENT, NOTE);
}
