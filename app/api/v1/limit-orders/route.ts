import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'user_default';
    // A price default is a fabrication: it silently prices a real decision
    // off a constant. 0.0425 was that constant here, identical for every
    // token. Absent now fails loudly instead.
    const currentPriceRaw = searchParams.get('currentPrice');
    const currentPrice = currentPriceRaw === null ? NaN : parseFloat(currentPriceRaw);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new ApiError('currentPrice is required to evaluate limit orders', 400);
    }

    const orders = limitOrderService.getUserLimitOrders(userId, currentPrice);

    return NextResponse.json({
      success: true,
      orders
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch limit orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId = 'user_default',
      walletId = 'w-solana-primary',
      chainId = 'solana',
      tokenIn = 'SOL',
      tokenOut = 'SENT',
      side = 'buy',
      targetPrice,
      amountIn,
      slippageBps = 100,
      conditions,
      expiresAt
    } = body;

    if (!targetPrice || !amountIn) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: targetPrice and amountIn' },
        { status: 400 }
      );
    }

    const result = limitOrderService.createLimitOrder({
      userId,
      walletId,
      chainId,
      tokenIn,
      tokenOut,
      side,
      targetPrice: parseFloat(targetPrice),
      amountIn: parseFloat(amountIn),
      slippageBps: parseInt(slippageBps, 10),
      conditions,
      expiresAt
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      order: result.order
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create limit order' },
      { status: 500 }
    );
  }
}
