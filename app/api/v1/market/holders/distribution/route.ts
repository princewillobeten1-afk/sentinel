export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenHolderDistribution } from '@/lib/api/birdeye/holder';

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
    
    const mode = (searchParams.get('mode') as 'percent' | 'top') || 'top';
    const addressType = (searchParams.get('address_type') as 'wallet' | 'token_account') || 'wallet';
    const includeList = searchParams.get('include_list') !== 'false';
    const topN = parseInt(searchParams.get('top_n') || '10');
    
    let minPercent, maxPercent;
    if (searchParams.has('min_percent')) minPercent = parseFloat(searchParams.get('min_percent') as string);
    if (searchParams.has('max_percent')) maxPercent = parseFloat(searchParams.get('max_percent') as string);

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const data = await getTokenHolderDistribution(
      tokenAddress, 
      mode, 
      addressType, 
      includeList, 
      topN, 
      minPercent, 
      maxPercent, 
      offset, 
      limit
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye holder distribution proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
