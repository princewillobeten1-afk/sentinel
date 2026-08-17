export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/wallets';
const NOTE =
  "Returned a fresh in-memory demo engine's wallets, not the caller's linked wallets.";

export async function GET() {
  return retiredRoute(REPLACEMENT, NOTE);
}
