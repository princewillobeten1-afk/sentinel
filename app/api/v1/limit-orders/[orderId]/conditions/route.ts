import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';
import { conditionEngine } from '@/lib/limit-order/condition-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const order = limitOrderService.getLimitOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Limit order not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    // A price default is a fabrication: it silently prices a real decision
    // off a constant. 0.0425 was that constant here, identical for every
    // token. Absent now fails loudly instead.
    const currentPriceRaw = searchParams.get('currentPrice');
    const currentPrice = currentPriceRaw === null ? NaN : parseFloat(currentPriceRaw);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new ApiError('currentPrice is required to evaluate order conditions', 400);
    }
    const mockLiquidity = searchParams.get('mockLiquidity') ? parseFloat(searchParams.get('mockLiquidity')!) : 850000;
    const mockExitability = searchParams.get('mockExitability') ? parseInt(searchParams.get('mockExitability')!, 10) : 84;

    const report = conditionEngine.evaluate(order, {
      currentPrice,
      liquidityUsd: mockLiquidity,
      exitabilityScore: mockExitability,
      insiderRiskLevel: 'Low',
      organicVolumeRatio: 0.92,
      expectedPriceImpactPct: 0.8
    });

    return NextResponse.json({
      success: true,
      orderId,
      status: order.status,
      health: order.health,
      report
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to evaluate order conditions' },
      { status: 500 }
    );
  }
}
