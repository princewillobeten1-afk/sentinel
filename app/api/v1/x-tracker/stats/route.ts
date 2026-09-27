export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getXTrackerStats } from '@/lib/x-tracker/x-tracker-service';

export async function GET() {
  try {
    const stats = getXTrackerStats();
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[API_X_TRACKER_STATS_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch X tracker statistics',
      },
      { status: 500 }
    );
  }
}
