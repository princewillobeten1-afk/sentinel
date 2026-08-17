export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenTransferList, getTokenTransferTotal } from '@/lib/api/birdeye/balance';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;
    const { searchParams } = new URL(request.url);

    const timeFrom = searchParams.get('time_from') ? parseInt(searchParams.get('time_from')!, 10) : undefined;
    const timeTo = searchParams.get('time_to') ? parseInt(searchParams.get('time_to')!, 10) : undefined;
    const fromAmount = searchParams.get('from_amount') ? parseFloat(searchParams.get('from_amount')!) : undefined;
    const toAmount = searchParams.get('to_amount') ? parseFloat(searchParams.get('to_amount')!) : undefined;
    const fromValue = searchParams.get('from_value') ? parseFloat(searchParams.get('from_value')!) : undefined;
    const toValue = searchParams.get('to_value') ? parseFloat(searchParams.get('to_value')!) : undefined;
    const fromWallet = searchParams.get('from_wallet') || undefined;
    const toWallet = searchParams.get('to_wallet') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const includeTotal = searchParams.get('include_total') === 'true';

    const [transfers, totalResult] = await Promise.all([
      getTokenTransferList(address, {
        time_from: timeFrom,
        time_to: timeTo,
        from_amount: fromAmount,
        to_amount: toAmount,
        from_value: fromValue,
        to_value: toValue,
        from_wallet: fromWallet,
        to_wallet: toWallet,
        cursor,
        limit,
        chain: chain || 'solana',
      }).catch((err) => {
        console.warn('Birdeye transfer list fallback:', err.message);
        return [];
      }),
      includeTotal
        ? getTokenTransferTotal(address, {
            time_from: timeFrom,
            time_to: timeTo,
            from_amount: fromAmount,
            to_amount: toAmount,
            from_value: fromValue,
            to_value: toValue,
            from_wallet: fromWallet,
            to_wallet: toWallet,
            chain: chain || 'solana',
          }).catch(() => ({ total: 0 }))
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        token: address,
        chain,
        items: transfers,
        total: totalResult?.total ?? transfers.length,
      },
    });
  } catch (error: any) {
    console.error('Token transfers route error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch token transfers' },
      { status: 500 }
    );
  }
}
