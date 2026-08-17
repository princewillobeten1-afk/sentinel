export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenHolders, getTokenHolderBatch } from '@/lib/api/birdeye/holder';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenAddress = searchParams.get('token');
    
    // Batch mode check
    const walletsParam = searchParams.get('wallets');
    
    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Must provide token parameter' },
        { status: 400 }
      );
    }
    
    if (walletsParam) {
      // Batch mode
      const wallets = walletsParam.split(',');
      const data = await getTokenHolderBatch(tokenAddress, wallets);
      return NextResponse.json({ success: true, data });
    } else {
      // Regular mode
      const mode = (searchParams.get('mode') as 'wallet' | 'token_account') || 'wallet';
      const limit = parseInt(searchParams.get('limit') || '10');
      
      const data = await getTokenHolders(tokenAddress, mode, 0, limit, true);
      return NextResponse.json({ success: true, data });
    }
  } catch (error: any) {
    console.error('Birdeye holders proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
