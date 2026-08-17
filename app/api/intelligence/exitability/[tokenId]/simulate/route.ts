export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ExitabilityEngine } from '@/lib/intelligence/exitability/engine';
import { TokenRestrictions } from '@/lib/intelligence/exitability/types';

export async function POST(request: Request, { params }: { params: { tokenId: string } }) {
  try {
    const { positionSizeUsd } = await request.json();
    
    if (!positionSizeUsd || typeof positionSizeUsd !== 'number') {
      return NextResponse.json({ error: 'Invalid positionSizeUsd' }, { status: 400 });
    }

    const engine = new ExitabilityEngine();

    // Mock liquidity
    const executableLiquidityUsd = 141000;
    
    const restrictions: TokenRestrictions = {
      canSell: true,
      sellTaxPct: 0
    };

    const estimate = engine.simulateExit(positionSizeUsd, executableLiquidityUsd, restrictions);

    return NextResponse.json(estimate);
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
