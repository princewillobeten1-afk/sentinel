export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenAllTimeTrades } from '@/lib/api/birdeye/trade';

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
    
    const timeFrame = searchParams.get('time_frame') || '24h';
    const chain = searchParams.get('chain') || 'solana';
    const uiAmountMode = (searchParams.get('ui_amount_mode') as 'raw' | 'scaled' | 'both') || 'raw';

    const data = await getTokenAllTimeTrades(
      tokenAddress,
      timeFrame,
      chain,
      uiAmountMode
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye all time trades single proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
