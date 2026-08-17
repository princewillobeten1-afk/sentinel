export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenTagHoldingsChart } from '@/lib/api/birdeye/holder';

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
    
    const chartType = (searchParams.get('chart_type') as '1d' | '1h' | '1m') || '1d';
    
    const tagTypeParam = searchParams.get('tag_type');
    let tagType: ('bundler' | 'sniper')[] | undefined = undefined;
    if (tagTypeParam) {
      tagType = tagTypeParam.split(',') as ('bundler' | 'sniper')[];
    }
    
    let from, to;
    if (searchParams.has('time_from')) from = parseInt(searchParams.get('time_from') as string);
    if (searchParams.has('time_to')) to = parseInt(searchParams.get('time_to') as string);

    const data = await getTokenTagHoldingsChart(
      tokenAddress,
      chartType,
      tagType,
      from,
      to
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye holder tag chart proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
