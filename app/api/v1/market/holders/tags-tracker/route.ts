export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getTokenWalletTagsTracker } from '@/lib/api/birdeye/holder';

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

    let timeTo;
    if (searchParams.has('time_to')) timeTo = parseInt(searchParams.get('time_to') as string);
    
    const timeFrame = searchParams.get('time_frame') || '1D';

    const tagsParam = searchParams.get('tags');
    let tags: ('dev' | 'sniper' | 'smart_trader')[] | undefined = undefined;
    if (tagsParam) {
      tags = tagsParam.split(',') as ('dev' | 'sniper' | 'smart_trader')[];
    }

    const top10Holder = searchParams.get('top_10_holder') === 'true';
    const includeTagCombinations = searchParams.get('include_tag_combinations') === 'true';

    const data = await getTokenWalletTagsTracker(
      tokenAddress,
      timeFrom,
      timeTo,
      timeFrame,
      tags,
      top10Holder,
      includeTagCombinations
    );
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Birdeye wallet tags tracker proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
