export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';

/**
 * Every order used to be filed under one shared 'user_default' identity, so
 * there was nothing to check here -- any caller could look up, modify or
 * cancel any order by guessing its id. Now that orders are scoped to a real
 * wallet address, this is the boundary that keeps that true: a caller must
 * supply the same `walletAddress` the order was created under.
 */
function assertOwnership(
  order: { userId: string } | undefined,
  walletAddress: string | null,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!order) return { ok: false, status: 404, error: 'Limit order not found' };
  if (!walletAddress) return { ok: false, status: 400, error: 'walletAddress is required' };
  if (order.userId !== walletAddress) {
    // Reported the same as "not found" -- confirming an order id belongs to
    // someone else is itself a information leak this route should not make.
    return { ok: false, status: 404, error: 'Limit order not found' };
  }
  return { ok: true };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const order = limitOrderService.getLimitOrder(orderId);
    const walletAddress = new URL(req.url).searchParams.get('walletAddress');

    const owned = assertOwnership(order, walletAddress);
    if (!owned.ok) {
      return NextResponse.json({ success: false, error: owned.error }, { status: owned.status });
    }

    const versions = limitOrderService.getOrderVersions(orderId);

    return NextResponse.json({
      success: true,
      order,
      versions
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch limit order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const body = await req.json();
    const existing = limitOrderService.getLimitOrder(orderId);

    const owned = assertOwnership(existing, body?.walletAddress ?? null);
    if (!owned.ok) {
      return NextResponse.json({ success: false, error: owned.error }, { status: owned.status });
    }

    const result = limitOrderService.modifyLimitOrder(orderId, body);

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
      { success: false, error: error.message || 'Failed to modify limit order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const order = limitOrderService.getLimitOrder(orderId);
    const walletAddress = new URL(req.url).searchParams.get('walletAddress');

    const owned = assertOwnership(order, walletAddress);
    if (!owned.ok) {
      return NextResponse.json({ success: false, error: owned.error }, { status: owned.status });
    }

    const result = limitOrderService.cancelLimitOrder(orderId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Limit order cancelled successfully',
      order: result.order
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel limit order' },
      { status: 500 }
    );
  }
}
