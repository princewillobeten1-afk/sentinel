export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ExitabilityEngine } from '@/lib/intelligence/exitability/engine';
import { TokenRestrictions } from '@/lib/intelligence/exitability/types';

export async function GET(request: Request, { params }: { params: { tokenId: string } }) {
  const engine = new ExitabilityEngine();

  // Mock token data
  const marketCapUsd = 12400000;
  const totalLiquidityUsd = 620000;
  const executableLiquidityUsd = 141000;
  
  const restrictions: TokenRestrictions = {
    canSell: true,
    sellTaxPct: 0
  };

  const baselineScore = engine.calculateBaselineExitability(
    params.tokenId,
    marketCapUsd,
    totalLiquidityUsd,
    executableLiquidityUsd,
    restrictions
  );

  return NextResponse.json(baselineScore);
}
