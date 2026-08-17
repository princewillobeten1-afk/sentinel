export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenWalletTagsTrackerDetails } from '@/lib/api/birdeye/holder';

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
    
    const timeFromStr = searchParams.get('time_from');
    if (!timeFromStr) {
      return NextResponse.json(
        { success: false, error: 'Must provide time_from parameter' },
        { status: 400 }
      );
    }
    const timeFrom = parseInt(timeFromStr);

    const timeFrame = searchParams.get('time_frame');
    if (!timeFrame) {
        return NextResponse.json(
            { success: false, error: 'Must provide time_frame parameter' },
            { status: 400 }
          );
    }

    let timeTo;
    if (searchParams.has('time_to')) timeTo = parseInt(searchParams.get('time_to') as string);
    
    const tagsParam = searchParams.get('tags');
    let tags: ('dev' | 'sniper' | 'smart_trader')[] | undefined = undefined;
    if (tagsParam) {
      tags = tagsParam.split(',') as ('dev' | 'sniper' | 'smart_trader')[];
    }

    const walletsParam = searchParams.get('wallets');
    let wallets: string[] | undefined = undefined;
    if (walletsParam) {
        wallets = walletsParam.split(',');
    }

    const minVolumeUsd = parseFloat(searchParams.get('min_volume_usd') || '0');
    const top10Holder = searchParams.get('top_10_holder') === 'true';
    const limitWallet = parseInt(searchParams.get('limit_wallet') || '10');
    const limitBucket = parseInt(searchParams.get('limit_bucket') || '300');

    const data = await getTokenWalletTagsTrackerDetails(
      tokenAddress,
      timeFrom,
      timeFrame,
      timeTo,
      tags,
      wallets,
      minVolumeUsd,
      top10Holder,
      limitWallet,
      limitBucket
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye wallet tags tracker details proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
