export const dynamic = 'force-dynamic';
import { retiredRoute } from '@/lib/server/retired-route';

const REPLACEMENT = '/api/v1/portfolio/:wallet';
const NOTE =
  'Synthesised a cost basis and fell back to four hardcoded demo tokens.';

export async function GET() {
  return retiredRoute(REPLACEMENT, NOTE);
}
