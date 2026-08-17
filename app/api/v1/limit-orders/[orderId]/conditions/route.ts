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
    const currentPrice = parseFloat(searchParams.get('currentPrice') || '0.0425');
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
