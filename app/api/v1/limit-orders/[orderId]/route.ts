export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { limitOrderService } from '@/lib/limit-order/limit-order-service';

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
