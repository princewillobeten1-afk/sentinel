export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTrendingTokens } from '@/lib/api/birdeye/discovery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // In production, you would add a fast in-memory or Redis cache here
    // since trending tokens change relatively slowly but are hit often.
    
    const data = await getTrendingTokens({ sort_by: 'rank', sort_type: 'asc', offset, limit });
    
    return NextResponse.json({ success: true, data }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error: any) {
    console.error('Birdeye trending proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
