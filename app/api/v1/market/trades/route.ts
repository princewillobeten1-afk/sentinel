export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenTrades, getTokenTradesByVolume } from '@/lib/api/birdeye/transactions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const whaleOnly = searchParams.get('whale_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Must provide address parameter' },
        { status: 400 }
      );
    }

    let data;
    if (whaleOnly) {
      // Fetch only trades > $10,000
      data = await getTokenTradesByVolume(address, 10000, 0, limit);
    } else {
      data = await getTokenTrades(address, 0, limit, 'swap');
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye trades proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
