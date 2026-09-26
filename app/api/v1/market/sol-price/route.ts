import { NextResponse } from 'next/server';
import { getSolPriceUsd } from '@/lib/market/canonical-price';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const solPriceUsd = await getSolPriceUsd();
    return NextResponse.json({
      success: true,
      data: {
        solPriceUsd,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch SOL price' },
      { status: 500 }
    );
  }
}
