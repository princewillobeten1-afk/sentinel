export const dynamic = 'force-dynamic';

import { getAllQualityProfiles } from '@/lib/server/nfr/quality-matrix';
import { jsonResponse } from '@/lib/server/api';

export async function GET() {
  const profiles = getAllQualityProfiles();
  return jsonResponse({
    version: 'Sprint 33 Production Standard',
    totalServices: profiles.length,
    profiles,
    timestamp: new Date().toISOString(),
  });
}
