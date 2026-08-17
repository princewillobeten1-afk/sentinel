export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  getWalletTokenBalance,
  getWalletTokensBalanceV2,
  getWalletBalanceChange,
} from '@/lib/api/birdeye/balance';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const token = searchParams.get('token');
    const tokens = searchParams.get('tokens');
    const history = searchParams.get('history') === 'true';
    const chain = searchParams.get('chain') || 'solana';

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Must provide wallet address parameter' },
        { status: 400 }
      );
    }

    // 1. Balance Change History
    if (history) {
      const type = searchParams.get('type') as 'SOL' | 'SPL' | undefined;
      const changeType = searchParams.get('change_type') as 'increase' | 'decrease' | undefined;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

      const data = await getWalletBalanceChange(wallet, {
        token_address: token || undefined,
        type,
        change_type: changeType,
        limit,
        chain,
      });

      return NextResponse.json({ success: true, data });
    }

    // 2. Multi-token Batch Balance Query
    if (tokens) {
      const tokenAddresses = tokens.split(',').map((t) => t.trim()).filter(Boolean);
      const data = await getWalletTokensBalanceV2(wallet, tokenAddresses, chain);
      return NextResponse.json({ success: true, data });
    }

    // 3. Single Token Balance Query
    if (token) {
      const data = await getWalletTokenBalance(wallet, token, { chain });
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: 'Must provide token, tokens, or history=true parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Birdeye balance proxy error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { wallet, token_addresses, tokens, chain = 'solana' } = body;

    const targetWallet = wallet;
    const targetTokens = token_addresses || tokens;

    if (!targetWallet || !Array.isArray(targetTokens)) {
      return NextResponse.json(
        { success: false, error: 'Request body must include wallet string and tokens array' },
        { status: 400 }
      );
    }

    const data = await getWalletTokensBalanceV2(targetWallet, targetTokens, chain);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye batch balance error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
