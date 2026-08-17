export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/trading/quote';
const NOTE =
  'Read back an in-memory intent; the v1 route runs the real quote router.';

export async function POST() {
  return retiredRoute(REPLACEMENT, NOTE);
}
