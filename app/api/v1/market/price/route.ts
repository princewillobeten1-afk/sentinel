export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenPrice, getMultiTokenPrice } from '@/lib/api/birdeye/price';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const addresses = searchParams.get('addresses'); // comma separated

    if (addresses) {
      const addressList = addresses.split(',');
      const data = await getMultiTokenPrice(addressList);
      return NextResponse.json({ success: true, data });
    }

    if (address) {
      const data = await getTokenPrice(address);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json(
      { success: false, error: 'Must provide address or addresses parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Birdeye proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
