export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenHolderPositions } from '@/lib/api/birdeye/holder';

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
    
    const labelsParam = searchParams.get('labels');
    const labels = labelsParam 
      ? labelsParam.split(',') as ('bundler' | 'sniper' | 'insider' | 'dev' | 'smart_trader')[]
      : ['bundler' as const];

    const includeZeroBalance = searchParams.get('include_zero_balance') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const data = await getTokenHolderPositions(
      tokenAddress,
      labels,
      includeZeroBalance,
      offset,
      limit
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye holder positions proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
