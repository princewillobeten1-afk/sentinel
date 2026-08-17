export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenHolderChart } from '@/lib/api/birdeye/holder';

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
    
    const chartType = (searchParams.get('chart_type') as '1d' | '1h' | '1m' | '1s') || '1h';
    const mode = (searchParams.get('mode') as 'no_fill' | 'padding') || 'padding';
    const percentMode = (searchParams.get('percent_mode') as 'beginning' | 'previous') || 'beginning';
    const count = parseInt(searchParams.get('count') || '20');
    
    let from, to;
    if (searchParams.has('from')) from = parseInt(searchParams.get('from') as string);
    if (searchParams.has('to')) to = parseInt(searchParams.get('to') as string);

    const data = await getTokenHolderChart(
      tokenAddress,
      chartType,
      mode,
      percentMode,
      count,
      from,
      to
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye holder chart proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
