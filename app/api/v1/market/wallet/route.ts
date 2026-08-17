export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getWalletPortfolio, getWalletPnL } from '@/lib/api/birdeye/wallet';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const type = searchParams.get('type') || 'portfolio'; // portfolio or pnl
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Must provide address parameter' },
        { status: 400 }
      );
    }

    let data;
    if (type === 'pnl') {
      data = await getWalletPnL(address);
    } else {
      data = await getWalletPortfolio(address);
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye wallet proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
