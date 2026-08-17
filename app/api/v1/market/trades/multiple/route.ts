export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenAllTimeTradesMultiple } from '@/lib/api/birdeye/trade';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokens, time_frame = '24h', chain = 'solana', ui_amount_mode = 'raw' } = body;
    
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Must provide tokens array' },
        { status: 400 }
      );
    }
    
    if (tokens.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Maximum 20 tokens allowed' },
        { status: 400 }
      );
    }

    const data = await getTokenAllTimeTradesMultiple(
      tokens,
      time_frame,
      chain,
      ui_amount_mode
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye all time trades multiple proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
