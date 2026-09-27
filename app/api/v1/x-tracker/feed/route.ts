export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { generateXTrackerFeed } from '@/lib/x-tracker/x-tracker-service';
import type { XCallCategory } from '@/lib/x-tracker/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') || 'all') as XCallCategory;
    const searchQuery = searchParams.get('search') || undefined;
    const minMcap = searchParams.get('minMcap') ? Number(searchParams.get('minMcap')) : undefined;
    const minPnl = searchParams.get('minPnl') ? Number(searchParams.get('minPnl')) : undefined;
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';

    const feed = await generateXTrackerFeed({
      category,
      searchQuery,
      minMcap,
      minPnl,
      verifiedOnly,
    });

    return NextResponse.json({
      success: true,
      data: feed,
      total: feed.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API_X_TRACKER_FEED_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch X tracker feed',
      },
      { status: 500 }
    );
  }
}
