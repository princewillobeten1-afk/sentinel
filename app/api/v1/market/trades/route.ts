export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenTrades, getTokenTradesByVolume } from '@/lib/api/birdeye/transactions';
import { PublicKey } from '@solana/web3.js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const whaleOnly = searchParams.get('whale_only') === 'true';
    const limit = Number(searchParams.get('limit') ?? 50);
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Must provide address parameter' },
        { status: 400 }
      );
    }
    try { new PublicKey(address); } catch {
      return NextResponse.json({ success: false, error: 'Invalid Solana token address' }, { status: 400 });
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ success: false, error: 'limit must be between 1 and 100' }, { status: 400 });
    }

    let data;
    if (whaleOnly) {
      // Fetch only trades > $10,000
      data = await getTokenTradesByVolume(address, 10000, 0, limit);
    } else {
      data = await getTokenTrades(address, 0, limit, 'swap');
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Birdeye trades proxy error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Trade data temporarily unavailable' },
      { status: 503 }
    );
  }
}
