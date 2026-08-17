export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/orders';
const NOTE =
  'Order placement now goes through the v1 order domain and its state machine.';

export async function POST() {
  return retiredRoute(REPLACEMENT, NOTE);
}
