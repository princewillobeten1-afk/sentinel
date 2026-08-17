export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenHolderProfile } from '@/lib/api/birdeye/holder';

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
    
    const includeZeroBalance = searchParams.get('include_zero_balance') !== 'false';

    const data = await getTokenHolderProfile(tokenAddress, includeZeroBalance);
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye holder profile proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
