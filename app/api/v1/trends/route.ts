export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { TrendsService } from '@/lib/trends/trends-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = TrendsService.getTrendingNarratives({
      source,
      category,
      search,
    });

    return NextResponse.json({
      success: true,
      data: result.trends,
      stats: result.stats,
      total: result.trends.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API_TRENDS_ERROR]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trending narratives',
      },
      { status: 500 }
    );
  }
}
