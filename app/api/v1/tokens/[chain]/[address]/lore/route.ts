import { NextResponse } from 'next/server';
import { LoreService } from '@/lib/lore/lore-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: { chain: string; address: string } | Promise<{ chain: string; address: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const { address } = resolvedParams;

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Token address is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || undefined;
    const name = searchParams.get('name') || undefined;
    const pairCreatedAtStr = searchParams.get('pairCreatedAt');
    const marketCapUsdStr = searchParams.get('marketCapUsd');

    const pairCreatedAt = pairCreatedAtStr ? Number(pairCreatedAtStr) : undefined;
    const marketCapUsd = marketCapUsdStr ? Number(marketCapUsdStr) : undefined;

    const lore = await LoreService.getLoreForToken({
      mint: address,
      symbol,
      name,
      pairCreatedAt,
      marketCapUsd,
    });

    return NextResponse.json({
      success: true,
      data: lore,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch token narrative and lore',
      },
      { status: 500 }
    );
  }
}
