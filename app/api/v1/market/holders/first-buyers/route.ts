export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenFirstBuyers } from '@/lib/api/birdeye/holder';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');
    
    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Must provide token parameter' },
        { status: 400 }
      );
    }
    
    const limit = parseInt(searchParams.get('limit') || '70');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Make sure offset + limit <= 1000 as per docs
    if (offset + limit > 1000) {
        return NextResponse.json(
            { success: false, error: 'offset + limit must be <= 1000' },
            { status: 400 }
        );
    }

    const data = await getTokenFirstBuyers(
      tokenAddress,
      offset,
      limit
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye first buyers proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
